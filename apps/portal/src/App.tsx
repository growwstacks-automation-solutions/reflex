import { useEffect, useReducer, useState } from "react";
import type { ReactNode } from "react";
import { Sidebar, PageHeader } from "@/components/Shell";
import type { Screen } from "@/components/Shell";
import { JobBoard, JobRow } from "@/components/JobBoard";
import type { TabId } from "@/components/JobBoard";
import { JobDetailPeek } from "@/components/JobDetailPeek";
import { ProposalWorkspace } from "@/components/ProposalWorkspace";
import type { WorkspaceStatus } from "@/components/ProposalWorkspace";
import { Conversations, Reporting, Assets } from "@/components/OtherScreens";
import { BellButton } from "@/components/bell";
import { Card } from "@/components/ui";
import { RXIcons } from "@/components/icons";
import { RX_DATA } from "@/lib/mock-data";
import type { ActionLink, Job } from "@/lib/types";

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
      <div style={{ flex: 1, overflowY: "auto", padding: "20px 28px 40px" }}>
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
  const [dark, setDark] = useState(false);
  const [screen, setScreen] = useState<Screen>("board");
  const [tab, setTab] = useState<TabId>("all");
  const [peekJob, setPeekJob] = useState<Job | null>(null);
  const [workspace, setWorkspace] = useState<{ job: Job; status: WorkspaceStatus; regen: boolean } | null>(null);
  const [loading, setLoading] = useState(false);
  const [convoId, setConvoId] = useState<string | null>(null);
  const [, force] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }, [dark]);

  // Board loading shimmer on tab change.
  useEffect(() => {
    if (screen !== "board") return;
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 650);
    return () => clearTimeout(t);
  }, [tab, screen]);

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
      <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-tertiary)" }}>
        <RXIcons.sync size={14} /> <span style={{ fontFamily: "var(--font-mono)" }}>synced 2 min ago</span>
      </span>
      <BellButton onNavigate={navigate} />
    </div>
  );

  const setNav = (id: Screen) => {
    setWorkspace(null);
    setScreen(id);
  };

  return (
    <div style={{ display: "flex", height: "100%" }}>
      <Sidebar screen={screen} setScreen={setNav} dark={dark} setDark={setDark} />
      <main style={{ flex: 1, minWidth: 0, height: "100%", overflow: "hidden" }}>
        {screen === "board" && (
          <JobBoard
            tab={tab}
            setTab={setTab}
            loading={loading}
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
    </div>
  );
}
