import { useEffect, useReducer, useState } from "react";
import type { ReactNode } from "react";
import { Sidebar, PageHeader, NAV } from "@/components/Shell";
import type { Screen } from "@/components/Shell";
import { JobBoard, JobRow, DEFAULT_CONTROLS } from "@/components/JobBoard";
import type { BoardControls, BoardStats } from "@/components/JobBoard";
import { JobDetailPeek } from "@/components/JobDetailPeek";
import { ProposalWorkspace } from "@/components/ProposalWorkspace";
import type { WorkspaceStatus } from "@/components/ProposalWorkspace";
import { Conversations, Reporting, Assets } from "@/components/OtherScreens";
import { BellButton } from "@/components/bell";
import { Card } from "@/components/ui";
import { RXIcons } from "@/components/icons";
import { RX_DATA } from "@/lib/mock-data";
import type { ActionLink, Job } from "@/lib/types";
import { useAuth } from "@/lib/auth";
import { LoginScreen } from "@/components/LoginScreen";
import { fetchBoard, UnauthorizedError } from "@/lib/api";
import { adaptJob } from "@/lib/adapt-job";

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
  const [, force] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }, [dark]);

  // Load the current page of the board whenever auth, the query controls, or a retry change.
  // Filtering/sorting/paging all run server-side, so each control change is a fresh fetch.
  useEffect(() => {
    if (!auth.token) return;
    let cancelled = false;
    setBoardLoading(true);
    setBoardError(null);
    fetchBoard(auth.token, {
      tab: controls.tab,
      page: controls.page,
      pageSize: PAGE_SIZE,
      relevance: controls.relevance,
      quality: controls.quality,
      sort: controls.sort,
      dir: controls.dir,
    })
      .then((res) => {
        if (cancelled) return;
        setBoardJobs(res.jobs.map(adaptJob));
        setBoardTotal(res.total);
        setBoardStats(res.stats);
        setBoardLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        if (err instanceof UnauthorizedError) {
          auth.signOut();
          return;
        }
        setBoardError(err instanceof Error ? err.message : "Failed to load the board.");
        setBoardLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [auth.token, reloadKey, controls]);

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
      <Sidebar screen={screen} setScreen={setNav} dark={dark} setDark={setDark} />
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
        {NAV.map((item) => {
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
