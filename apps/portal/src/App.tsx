import { useEffect, useReducer, useState } from "react";
import type { ReactNode } from "react";
import { Sidebar, PageHeader, NAV } from "@/components/Shell";
import type { Screen, ExtTab } from "@/components/Shell";
import { JobBoard, JobRow, DEFAULT_CONTROLS } from "@/components/JobBoard";
import type { BoardControls, BoardStats } from "@/components/JobBoard";
import { JobDetailPeek } from "@/components/JobDetailPeek";
import { ProposalWorkspace } from "@/components/ProposalWorkspace";
import type { WorkspaceStatus } from "@/components/ProposalWorkspace";
import { Conversations, Reporting, Assets } from "@/components/OtherScreens";
import { ExtensionScreen } from "@/components/ExtensionScreen";
import { BellButton } from "@/components/bell";
import { Card } from "@/components/ui";
import { RXIcons } from "@/components/icons";
import { RX_DATA } from "@/lib/mock-data";
import type { ActionLink, Job } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { LoginScreen } from "@/components/LoginScreen";
import { fetchBoard, checkJobs, fetchReps, assignJobToRep, UnauthorizedError } from "@/lib/api";
import type { Rep, JobCheckStatus } from "@/lib/api";
import { adaptJob } from "@/lib/adapt-job";

/* Merge a /jobs/check status onto a board Job: fill the assignee from jobs.picked_by_name and, if
   the base row wasn't already actioned, reflect the drafted/generated/submitted pipeline state. */
function mergeCheckStatus(job: Job, s: JobCheckStatus | undefined): Job {
  if (!s) return job;
  const owner = s.owner
    ? { name: s.owner, first: s.owner.split(" ")[0], bg: "var(--surface-2)", fg: "var(--text-secondary)" }
    : job.owner;
  let actionState = job.actionState;
  if (actionState === "not-actioned") {
    if (s.actioned === "submitted") actionState = "submitted";
    else if (s.actioned === "generated") actionState = "generated";
  }
  // picked_by_name means someone owns it, even without a live job_assignments row.
  const ownership = owner && job.ownership === "available" ? "other" : job.ownership;
  return { ...job, owner, actionState, ownership };
}

/* The "Proposals" screen — drafts/submissions the rep is working. */
function ProposalsScreen({
  headerRight,
  onOpenWorkspace,
}: {
  headerRight: ReactNode;
  onOpenWorkspace: (job: Job, status?: WorkspaceStatus, regen?: boolean) => void;
}) {
  const jobs = RX_DATA.jobs.filter(
    (j) => j.ownership === "mine" || j.actionState === "submitted" || j.actionState === "conversation"
  );
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <PageHeader title="Proposals" subtitle="Drafts and submissions you're working." right={headerRight} />
      <div className="rx-page-content" style={{ flex: 1, overflowY: "auto", padding: "20px 28px 40px" }}>
        <Card pad="0" style={{ overflow: "hidden" }}>
          {jobs.map((job) => (
            <JobRow
              key={job.id}
              job={job}
              onOpen={() => onOpenWorkspace(job, job.actionState === "submitted" ? "done" : "idle")}
              onGenerate={() => onOpenWorkspace(job, "idle")}
              onAssign={() => {}}
              onRegenerate={() => onOpenWorkspace(job, "done", true)}
            />
          ))}
        </Card>
      </div>
    </div>
  );
}

/* App state machine: theme, screens, peek, workspace, bell deep-links. */
export default function App() {
  const auth = useAuth();
  const [dark, setDark] = useState(false);
  const [screen, setScreen] = useState<Screen>("board");
  const [extTab, setExtTab] = useState<ExtTab>("download");
  const [controls, setControls] = useState<BoardControls>(DEFAULT_CONTROLS);
  const [peekJob, setPeekJob] = useState<Job | null>(null);
  const [workspace, setWorkspace] = useState<{ job: Job; status: WorkspaceStatus; regen: boolean } | null>(null);
  const [boardJobs, setBoardJobs] = useState<Job[]>([]);
  const [boardStats, setBoardStats] = useState<BoardStats>({ on_board: 0, relevant: 0, review: 0, submitted: 0 });
  const [boardTotal, setBoardTotal] = useState(0);
  const PAGE_SIZE = 50;
  const [boardLoading, setBoardLoading] = useState(true);
  const [boardError, setBoardError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [convoId, setConvoId] = useState<string | null>(null);
  const [reps, setReps] = useState<Rep[]>([]);
  const [, force] = useReducer((x: number) => x + 1, 0);

  const isAdmin = auth.user?.role === "admin";

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }, [dark]);

  // Load the current page of the board whenever auth, the query controls, or a retry change.
  // Filtering/sorting/paging all run server-side, so each control change is a fresh fetch.
  useEffect(() => {
    if (!auth.token) return;
    const token = auth.token;
    let cancelled = false;
    setBoardLoading(true);
    setBoardError(null);

    // Best-effort enrichment: fill assignee (jobs.picked_by_name) + pipeline status from the
    // already-deployed /jobs/check (the board query doesn't return picked_by_name).
    const enrich = (jobs: Job[]) => {
      checkJobs(jobs.map((j) => j.id))
        .then((statuses) => {
          if (cancelled) return;
          setBoardJobs((prev) => prev.map((j) => mergeCheckStatus(j, statuses[j.id])));
        })
        .catch(() => {
          /* enrichment is best-effort; a failure just leaves the base board */
        });
    };
    const fail = (err: unknown) => {
      if (cancelled) return;
      if (err instanceof UnauthorizedError) {
        auth.signOut();
        return;
      }
      setBoardError(err instanceof Error ? err.message : "Failed to load the board.");
      setBoardLoading(false);
    };

    // Submitted KPI = a client-side aggregate (no Worker filter). Submitted proposals are always
    // the rep's OWN jobs, so we page through the "mine" scope (small — a couple of pages) and keep
    // only submitted rows. Admins have no "mine" scope, so they scan "all" (capped).
    if (controls.submittedView) {
      const aggTab: "mine" | "all" = isAdmin ? "all" : "mine";
      const AGG_SIZE = 100;
      (async () => {
        try {
          const base = { relevance: controls.relevance, quality: controls.quality, from: controls.dateFrom, to: controls.dateTo, sort: controls.sort, dir: controls.dir } as const;
          const first = await fetchBoard(token, { ...base, tab: aggTab, page: 1, pageSize: AGG_SIZE });
          let rows = first.jobs;
          const pages = Math.min(20, Math.ceil((first.total || 0) / AGG_SIZE)); // cap: 20 pages (~2000 jobs)
          for (let p = 2; p <= pages && !cancelled; p++) {
            const res = await fetchBoard(token, { ...base, tab: aggTab, page: p, pageSize: AGG_SIZE });
            rows = rows.concat(res.jobs);
          }
          if (cancelled) return;
          const submitted = rows.map(adaptJob).filter((j) => j.actionState === "submitted");
          setBoardJobs(submitted);
          setBoardTotal(submitted.length);
          setBoardLoading(false); // keep the last stats so the KPI numbers don't jump
          enrich(submitted);
        } catch (err) {
          fail(err);
        }
      })();
      return () => {
        cancelled = true;
      };
    }

    fetchBoard(token, {
      tab: controls.tab,
      page: controls.page,
      pageSize: PAGE_SIZE,
      relevance: controls.relevance,
      quality: controls.quality,
      from: controls.dateFrom,
      to: controls.dateTo,
      sort: controls.sort,
      dir: controls.dir,
    })
      .then((res) => {
        if (cancelled) return;
        const jobs = res.jobs.map(adaptJob);
        setBoardJobs(jobs);
        setBoardTotal(res.total);
        setBoardStats(res.stats);
        setBoardLoading(false);
        enrich(jobs);
      })
      .catch(fail);
    return () => {
      cancelled = true;
    };
  }, [auth.token, reloadKey, controls, isAdmin]);

  // Admins get the rep list (for the row-action assign picker). Fetched once on auth.
  useEffect(() => {
    if (!auth.token || !isAdmin) return;
    let cancelled = false;
    fetchReps(auth.token)
      .then((rows) => {
        if (!cancelled) setReps(rows);
      })
      .catch((err) => {
        if (err instanceof UnauthorizedError) auth.signOut();
        // A reps-load failure isn't fatal — the picker just shows empty; board still works.
      });
    return () => {
      cancelled = true;
    };
  }, [auth.token, isAdmin]);

  const openWorkspace = (job: Job, status?: WorkspaceStatus, regen?: boolean) => {
    setPeekJob(null);
    setWorkspace({ job, status: status || "idle", regen: !!regen });
    setScreen("workspace");
  };
  const onGenerate = (job: Job) => openWorkspace(job, "idle");
  const onRegenerate = (job: Job) => openWorkspace(job, "done", true);
  const onAssign = (job: Job) => {
    job.ownership = "mine";
    setPeekJob(null);
    force();
  };

  // Admin (re)assigns a job to a chosen rep. Persists via the API, then updates the row.
  const onAssignToRep = async (job: Job, repId: string) => {
    if (!auth.token) return;
    const rep = reps.find((r) => r.id === repId);
    try {
      const res = await assignJobToRep(auth.token, job.id, repId);
      const ownerName = res.owner_name ?? rep?.full_name ?? "";
      // Mutate the row in place: it now belongs to that rep ("other" from the admin's view).
      const isMe = auth.user?.id === repId;
      job.ownership = isMe ? "mine" : "other";
      job.owner = isMe
        ? undefined
        : { name: ownerName, first: ownerName.split(" ")[0], bg: "var(--surface-2)", fg: "var(--text-secondary)" };
      force();
    } catch (err) {
      if (err instanceof UnauthorizedError) {
        auth.signOut();
        return;
      }
      // Surface the failure; the board state is unchanged.
      alert(err instanceof Error ? err.message : "Couldn't assign the job.");
    }
  };
  const onMarkSubmitted = (job: Job) => {
    job.actionState = "submitted";
    force();
  };

  const navigate = (link: ActionLink) => {
    if (link.type === "conversation") {
      setConvoId(link.id);
      setScreen("convos");
    } else if (link.type === "job") {
      const job = RX_DATA.jobs.find((j) => j.id === link.id);
      if (job) {
        setScreen("board");
        setPeekJob(job);
      }
    }
  };

  const headerRightSimple = (
    <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
      <span className="rx-sync-text" style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-tertiary)" }}>
        <RXIcons.sync size={14} /> <span style={{ fontFamily: "var(--font-mono)" }}>synced 2 min ago</span>
      </span>
      <BellButton onNavigate={navigate} />
    </div>
  );

  const setNav = (id: Screen) => {
    setWorkspace(null);
    setScreen(id);
  };

  if (!auth.isAuthenticated) return <LoginScreen />;

  return (
    <div className="rx-app-shell" style={{ display: "flex", height: "100%" }}>
      <Sidebar screen={screen} setScreen={setNav} extTab={extTab} setExtTab={setExtTab} dark={dark} setDark={setDark} />
      <main className="rx-app-main" style={{ flex: 1, minWidth: 0, height: "100%", overflow: "hidden" }}>
        {screen === "board" && (
          <JobBoard
            controls={controls}
            setControls={setControls}
            stats={boardStats}
            total={boardTotal}
            pageSize={PAGE_SIZE}
            loading={boardLoading}
            jobs={boardJobs}
            error={boardError}
            onRetry={() => setReloadKey((k) => k + 1)}
            onNavigate={navigate}
            onOpen={setPeekJob}
            onGenerate={onGenerate}
            onAssign={onAssign}
            onRegenerate={onRegenerate}
            isAdmin={!!isAdmin}
            reps={reps}
            onAssignToRep={onAssignToRep}
          />
        )}
        {screen === "workspace" && workspace && (
          <ProposalWorkspace
            job={workspace.job}
            initialStatus={workspace.status}
            regenAtOpen={workspace.regen}
            onBack={() => {
              setWorkspace(null);
              setScreen("board");
            }}
            onMarkSubmitted={onMarkSubmitted}
          />
        )}
        {screen === "extension" && <ExtensionScreen tab={extTab} setTab={setExtTab} />}
        {screen === "convos" && <Conversations headerRight={headerRightSimple} selectedId={convoId} />}
        {screen === "props" && <ProposalsScreen headerRight={headerRightSimple} onOpenWorkspace={openWorkspace} />}
        {screen === "report" && <Reporting headerRight={headerRightSimple} />}
        {screen === "assets" && <Assets headerRight={headerRightSimple} />}
      </main>

      {peekJob && (
        <JobDetailPeek job={peekJob} onClose={() => setPeekJob(null)} onGenerate={onGenerate} onAssign={onAssign} />
      )}

      {/* Mobile bottom tab bar — hidden on desktop via CSS */}
      <nav className="rx-bottom-nav">
        {NAV.filter((item) => !item.hidden).map((item) => {
          const active = screen === item.id || (item.id === "props" && screen === "workspace");
          return (
            <button
              key={item.id}
              className={`rx-bottom-nav-btn${active ? " active" : ""}`}
              onClick={() => setNav(item.id)}
              style={{ position: "relative" }}
            >
              <item.icon size={20} />
              <span>{item.label}</span>
              {item.badge ? (
                <span className="rx-bottom-nav-badge">{item.badge}</span>
              ) : null}
            </button>
          );
        })}
      </nav>
    </div>
  );
}
