import { useEffect, useReducer, useState } from "react";
import { Sidebar } from "@/components/Shell";
import type { Screen } from "@/components/Shell";
import { JobBoard } from "@/components/JobBoard";
import type { TabId } from "@/components/JobBoard";
import { JobDetailPeek } from "@/components/JobDetailPeek";
import { RX_DATA } from "@/lib/mock-data";
import type { ActionLink, Job } from "@/lib/types";

/**
 * Phase 2 app root — Sidebar + Job board + detail peek wired against the
 * mock data, with the remaining screens (conversations, proposals, reporting,
 * assets) and the proposal workspace shown as placeholders until Phase 3.
 * The full AppV3 state machine replaces this once those screens land.
 */
function placeholderTitle(screen: Screen): string {
  switch (screen) {
    case "convos":
      return "Conversations";
    case "props":
      return "Proposals";
    case "report":
      return "Reporting";
    case "assets":
      return "Assets";
    default:
      return "Coming soon";
  }
}

function Placeholder({ title }: { title: string }) {
  return (
    <div
      style={{
        height: "100%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        textAlign: "center",
        padding: 40,
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-accent)",
          fontSize: "var(--fs-display)",
          fontWeight: 500,
          color: "var(--text-primary)",
        }}
      >
        {title}
      </div>
      <p style={{ margin: 0, fontSize: "var(--fs-body)", color: "var(--text-secondary)" }}>
        This screen arrives in Phase 3.
      </p>
    </div>
  );
}

export default function App() {
  const [dark, setDark] = useState(false);
  const [screen, setScreen] = useState<Screen>("board");
  const [tab, setTab] = useState<TabId>("all");
  const [peekJob, setPeekJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(false);
  const [, force] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
  }, [dark]);

  // Board loading shimmer on tab change (matches AppV3).
  useEffect(() => {
    if (screen !== "board") return;
    setLoading(true);
    const t = setTimeout(() => setLoading(false), 650);
    return () => clearTimeout(t);
  }, [tab, screen]);

  const onOpen = (job: Job) => setPeekJob(job);
  const onGenerate = (_job: Job) => {
    /* proposal workspace lands in Phase 3 */
  };
  const onRegenerate = (_job: Job) => {
    /* proposal workspace lands in Phase 3 */
  };
  const onAssign = (job: Job) => {
    job.ownership = "mine";
    setPeekJob(null);
    force();
  };

  const onNavigate = (link: ActionLink) => {
    if (link.type === "job") {
      const job = RX_DATA.jobs.find((j) => j.id === link.id);
      if (job) {
        setScreen("board");
        setPeekJob(job);
      }
    }
    // conversation deep-links arrive in Phase 3
  };

  return (
    <div style={{ display: "flex", height: "100%" }}>
      <Sidebar screen={screen} setScreen={setScreen} dark={dark} setDark={setDark} />
      <main style={{ flex: 1, minWidth: 0, height: "100%", overflow: "hidden" }}>
        {screen === "board" ? (
          <JobBoard
            tab={tab}
            setTab={setTab}
            loading={loading}
            onNavigate={onNavigate}
            onOpen={onOpen}
            onGenerate={onGenerate}
            onAssign={onAssign}
            onRegenerate={onRegenerate}
          />
        ) : (
          <Placeholder title={placeholderTitle(screen)} />
        )}
      </main>

      {peekJob && (
        <JobDetailPeek
          job={peekJob}
          onClose={() => setPeekJob(null)}
          onGenerate={onGenerate}
          onAssign={onAssign}
        />
      )}
    </div>
  );
}
