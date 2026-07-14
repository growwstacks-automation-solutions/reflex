/* Reflex portal — Extension screen. Which section shows is driven by the sidebar sub-nav
   (App owns `tab`); this component only renders the active section. Content is written for
   non-technical reps: short sentences, one action per step, a screenshot on every step.

   Screenshots: each <Shot> points at EXT_GUIDE_BASE/<file>.png (ImageKit, Reflex folder).
   If a file is missing, it renders a labelled placeholder describing what to capture.

   The .zip ships as a portal static asset (apps/portal/public/reflex-extension.zip →
   served at <origin>/reflex-extension.zip), so the download is same-origin, no backend. */
import { useState } from "react";
import type { ReactNode } from "react";
import { Button } from "@/components/ds";
import { Card, Eyebrow } from "@/components/ui";
import { RXIcons } from "@/components/icons";
import { PageHeader } from "@/components/Shell";
import type { ExtTab } from "@/components/Shell";

// Bump this when you repackage apps/extension → public/reflex-extension.zip (keep it in sync
// with apps/extension/manifest.json "version"). See docs/RUNBOOK.md "Package the extension".
const EXT_VERSION = "0.1.0";
const EXT_ZIP_URL = "/reflex-extension.zip";

// Guide screenshots live in ImageKit (Reflex folder), not in the build. To swap/add a shot,
// upload a PNG to this folder keeping the same filename — no code change needed.
const EXT_GUIDE_BASE = "https://ik.imagekit.io/r2zdlyze2o/Reflex";

/* A screenshot frame. Shows /ext-guide/<src> if it exists, else a labelled placeholder telling
   whoever maintains this exactly which screenshot to drop in and where. */
function Shot({ src, alt }: { src: string; alt: string }): JSX.Element {
  const [failed, setFailed] = useState(false);
  const url = `${EXT_GUIDE_BASE}/${src}`;
  if (failed) {
    return (
      <div
        style={{
          marginTop: 12,
          border: "1.5px dashed var(--border)",
          borderRadius: "var(--radius-card)",
          background: "var(--surface-2)",
          padding: "22px 18px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 7,
          textAlign: "center",
        }}
      >
        <span style={{ color: "var(--text-tertiary)" }}><RXIcons.image size={26} /></span>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)" }}>{alt}</div>
        <div style={{ fontSize: 11, fontFamily: "var(--font-mono)", color: "var(--text-tertiary)" }}>
          add screenshot → ImageKit Reflex/{src}
        </div>
      </div>
    );
  }
  return (
    <img
      src={url}
      alt={alt}
      onError={() => setFailed(true)}
      style={{
        marginTop: 12,
        display: "block",
        maxWidth: "100%",
        borderRadius: "var(--radius-card)",
        border: "1px solid var(--border)",
        boxShadow: "var(--shadow-sm, 0 1px 2px rgba(0,0,0,0.06))",
      }}
    />
  );
}

/* A numbered step: big number, title, plain-language body, and a screenshot. */
function Step({ n, title, children, shot }: { n: number; title: string; children: ReactNode; shot?: { src: string; alt: string } }): JSX.Element {
  return (
    <div style={{ display: "flex", gap: 15, alignItems: "flex-start" }}>
      <span
        style={{
          width: 30,
          height: 30,
          flex: "none",
          borderRadius: 999,
          background: "var(--indigo-500)",
          color: "#fff",
          fontSize: 14,
          fontWeight: 700,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "var(--shadow-indigo)",
        }}
      >
        {n}
      </span>
      <div style={{ flex: 1, minWidth: 0, paddingTop: 3 }}>
        <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 5 }}>{title}</div>
        <div style={{ fontSize: 13.5, lineHeight: 1.65, color: "var(--text-secondary)" }}>{children}</div>
        {shot ? <Shot src={shot.src} alt={shot.alt} /> : null}
      </div>
    </div>
  );
}

/* A feature row for the guide. */
function Feature({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }): JSX.Element {
  return (
    <Card style={{ display: "flex", gap: 13, alignItems: "flex-start" }}>
      <span
        style={{
          width: 38,
          height: 38,
          flex: "none",
          borderRadius: 10,
          background: "var(--indigo-50)",
          color: "var(--accent)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {icon}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 3 }}>{title}</div>
        <div style={{ fontSize: 12.5, lineHeight: 1.55, color: "var(--text-secondary)" }}>{children}</div>
      </div>
    </Card>
  );
}

/* A coloured callout (info / warn). */
function Note({ tone, icon, children }: { tone: "info" | "warn"; icon: ReactNode; children: ReactNode }): JSX.Element {
  const bg = tone === "warn" ? "var(--review-fill)" : "var(--indigo-50)";
  const fg = tone === "warn" ? "var(--review-text)" : "var(--accent-on-tint)";
  return (
    <div style={{ display: "flex", gap: 11, padding: "13px 15px", borderRadius: "var(--radius-card)", background: bg, color: fg }}>
      <span style={{ flex: "none", marginTop: 1, color: tone === "warn" ? "inherit" : "var(--accent)" }}>{icon}</span>
      <div style={{ fontSize: 12.5, lineHeight: 1.6 }}>{children}</div>
    </div>
  );
}

/* Inline keyboard / path hint. */
function Kbd({ children }: { children: ReactNode }): JSX.Element {
  return (
    <span
      style={{
        fontFamily: "var(--font-mono)",
        fontSize: 12,
        padding: "1px 6px",
        borderRadius: 5,
        background: "var(--surface-2)",
        border: "1px solid var(--border)",
        color: "var(--text-primary)",
        whiteSpace: "nowrap",
      }}
    >
      {children}
    </span>
  );
}

const SUBTITLE: Record<ExtTab, string> = {
  download: "Get the Reflex copilot that lives on Upwork.",
  install: "A simple, step-by-step setup — about a minute, no technical know-how needed.",
  guide: "What Reflex does and exactly how to use it to apply on Upwork faster.",
};

export function ExtensionScreen({
  headerRight,
  tab,
  setTab,
}: {
  headerRight?: ReactNode;
  tab: ExtTab;
  setTab: (t: ExtTab) => void;
}): JSX.Element {
  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <PageHeader title="Extension" subtitle={SUBTITLE[tab]} right={headerRight} />

      <div className="rx-page-content" style={{ flex: 1, overflowY: "auto", padding: "24px 28px 48px" }}>
        <div style={{ maxWidth: 1040, margin: "0 auto" }}>
          {tab === "download" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 18 }}>
              <Card style={{ display: "flex", alignItems: "center", gap: 18, padding: "22px 24px", flexWrap: "wrap" }}>
                <span
                  style={{
                    width: 54,
                    height: 54,
                    flex: "none",
                    borderRadius: 14,
                    background: "var(--indigo-500)",
                    color: "#fff",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    boxShadow: "var(--shadow-indigo)",
                  }}
                >
                  <RXIcons.puzzle size={26} />
                </span>
                <div style={{ flex: 1, minWidth: 180 }}>
                  <div style={{ fontSize: 16, fontWeight: 700 }}>Reflex — Upwork copilot</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>
                    Latest build · v{EXT_VERSION} · works in Chrome &amp; Edge
                  </div>
                </div>
                <a href={EXT_ZIP_URL} download style={{ textDecoration: "none", flex: "none" }}>
                  <Button icon={<RXIcons.download size={16} />}>Download .zip</Button>
                </a>
              </Card>

              <div style={{ fontSize: 13.5, lineHeight: 1.7, color: "var(--text-secondary)" }}>
                <p style={{ margin: "0 0 10px" }}>
                  Click <b>Download .zip</b> above. This one file is the whole Reflex extension.
                </p>
                <p style={{ margin: 0 }}>
                  It isn't in the Chrome Web Store, so you add it to your browser yourself — it's easy and
                  only takes a minute. When the file finishes downloading, open the{" "}
                  <button
                    onClick={() => setTab("install")}
                    style={{ border: "none", background: "none", padding: 0, cursor: "pointer", color: "var(--accent)", fontWeight: 700, fontSize: 13.5 }}
                  >
                    How to install
                  </button>{" "}
                  section on the left and just follow the pictures.
                </p>
              </div>

              <Note tone="info" icon={<RXIcons.spark size={15} />}>
                Tip: remember which folder your browser saves downloads to (usually{" "}
                <b>Downloads</b>) — you'll point Chrome at this file in the next step.
              </Note>
            </div>
          )}

          {tab === "install" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
              <Card style={{ display: "flex", flexDirection: "column", gap: 26, padding: "24px 26px" }}>
                <Step
                  n={1}
                  title="Unzip the file you downloaded"
                  shot={{ src: "01-unzip.png", alt: "Right-click the downloaded zip → Extract All" }}
                >
                  Find the <Kbd>reflex-extension.zip</Kbd> file in your Downloads. <b>Right-click it</b> and
                  choose <b>Extract All</b> (on a Mac, just double-click it). You'll get a folder named{" "}
                  <Kbd>extension</Kbd>. Leave this folder where it is — don't delete it later, because your
                  browser reads Reflex from it.
                </Step>
                <Step
                  n={2}
                  title="Open the Extensions menu → Manage extensions"
                  shot={{ src: "02-manage-extensions.png", alt: "Puzzle-piece Extensions menu open, with Manage extensions at the bottom" }}
                >
                  Click the <b>puzzle-piece</b> icon in the top-right of your browser. A menu opens listing
                  your add-ons. At the very bottom, click <b>Manage extensions</b>.
                </Step>
                <Step
                  n={3}
                  title='Turn on "Developer mode", then click "Load unpacked"'
                  shot={{ src: "03-load-unpacked.png", alt: "Extensions page with Developer mode on (top-right) and Load unpacked (top-left)" }}
                >
                  On the Extensions page, switch on <b>Developer mode</b> in the <b>top-right</b> corner if
                  it isn't already. A row of buttons appears — click <b>Load unpacked</b> on the left.
                </Step>
                <Step
                  n={4}
                  title="Choose the extracted extension folder"
                  shot={{ src: "04-select-folder.png", alt: "File picker with the extracted extension folder selected → Select Folder" }}
                >
                  A window opens. Select the <Kbd>extension</Kbd> folder you unzipped in step 1, then click{" "}
                  <b>Select Folder</b>. Reflex now appears in your list — it's installed.
                </Step>
                <Step
                  n={5}
                  title="Pin Reflex so it's always handy"
                  shot={{ src: "05-pin.png", alt: "Clicking the pin next to Reflex — Upwork copilot in the Extensions menu" }}
                >
                  Click the <b>puzzle-piece</b> icon again and click the <b>pin</b> next to{" "}
                  <b>Reflex — Upwork copilot</b> so its icon stays visible in your toolbar.
                </Step>
                <Step
                  n={6}
                  title="Open Upwork and log in"
                  shot={{ src: "06-upwork-open.png", alt: "The Reflex panel open on an Upwork page, signed in" }}
                >
                  Open any <b>upwork.com</b> page. The Reflex panel appears on the right — log in with your
                  Reflex account, and you'll see it working on your Upwork pages. That's everything.
                </Step>
              </Card>

              <div>
                <Eyebrow style={{ marginBottom: 10 }}>Getting a newer version later</Eyebrow>
                <Card style={{ padding: "16px 18px", fontSize: 13.5, lineHeight: 1.65, color: "var(--text-secondary)" }}>
                  When we release an update, come back here, download the new <Kbd>.zip</Kbd>, unzip it and
                  let it <b>replace</b> the old <Kbd>extension</Kbd> folder. Then open the Extensions page
                  again and click the <b>↻ reload</b> icon on the Reflex card. You stay logged in.
                </Card>
              </div>

              <Note tone="warn" icon={<RXIcons.clock size={15} />}>
                <b>Please only install this on an established Upwork account.</b> Reflex never submits or
                refreshes anything by itself — it only acts when you click — but as a precaution, don't run
                it on a brand-new account.
              </Note>
            </div>
          )}

          {tab === "guide" && (
            <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
              <div style={{ fontSize: 13.5, lineHeight: 1.7, color: "var(--text-secondary)" }}>
                Reflex sits on top of Upwork like a helper panel. It reads what's already on your screen and
                only does something when you click — it never browses, refreshes, or submits on its own.
                Here's everything it does and how each part helps you apply faster.
              </div>

              <div>
                <Eyebrow style={{ marginBottom: 12 }}>What Reflex can do</Eyebrow>
                <div style={{ display: "flex", flexDirection: "column", gap: 11 }}>
                  <Feature icon={<RXIcons.board size={19} />} title="A label on every job listing">
                    On Upwork's job lists, each job gets a small Reflex tag telling you whether it's already
                    in Reflex, how good a fit it is, and who (if anyone) on the team is already on it — so
                    you don't waste a connect on a job that's taken or a poor match.
                  </Feature>
                  <Feature icon={<RXIcons.plus size={19} />} title="Add to Reflex">
                    On a job's page, one click saves the job and the client's details (spend, rating, hire
                    rate, location, payment-verified) into Reflex, so the whole team can see it's being
                    worked on.
                  </Feature>
                  <Feature icon={<RXIcons.spark size={19} />} title="Write my proposal (AI)">
                    On the proposal page, click <b>Generate</b> and Reflex writes the full cover letter,
                    answers the screening questions, greets the client by name when it can find it, and picks
                    the best work samples — then fills the form for you. You just read it, tweak, and submit.
                  </Feature>
                  <Feature icon={<RXIcons.chat size={19} />} title="Reply to messages faster">
                    Open a client chat and Reflex can pull in the conversation and draft a suggested reply
                    plus a short summary of where things stand. You copy it, edit if needed, and send —
                    Reflex never sends for you.
                  </Feature>
                  <Feature icon={<RXIcons.check size={19} />} title="Saves your proposal automatically">
                    After you submit on Upwork, Reflex records it for you (who submitted, connects spent, the
                    proposal link) — no extra click — so the team's numbers stay correct.
                  </Feature>
                  <Feature icon={<RXIcons.refresh size={19} />} title="Movable and out of the way">
                    Move the panel to the left or right corner with the ⇄ button; it remembers your choice.
                  </Feature>
                </div>
              </div>

              <div>
                <Eyebrow style={{ marginBottom: 12 }}>Applying to a job, start to finish</Eyebrow>
                <Card style={{ display: "flex", flexDirection: "column", gap: 26, padding: "24px 26px" }}>
                  <Step
                    n={1}
                    title="Browse jobs — Reflex labels each one"
                    shot={{ src: "use-01-panel.png", alt: "The Reflex panel on an Upwork job list showing fit labels, who it's assigned to, and Generate" }}
                  >
                    Open Upwork and look through jobs. In the Reflex panel each job shows its fit (e.g.{" "}
                    <b>Needs review · Medium fit</b>), who on the team it's <b>assigned</b> to, and whether a{" "}
                    <b>proposal was already submitted</b> — so you don't double up or waste a connect.
                  </Step>
                  <Step
                    n={2}
                    title="Click Generate — Reflex writes the proposal"
                    shot={{ src: "use-02-generate.png", alt: "The apply page with the generated cover letter (client greeted by name) and downloadable attachments" }}
                  >
                    Hit <b>Generate</b> on a job and Reflex takes you to the apply page with the{" "}
                    <b>cover letter already written</b> — including the client's name pulled from their
                    reviews — plus the <b>attachments and proposal assets</b> ready to download and attach.
                  </Step>
                  <Step
                    n={3}
                    title="Read it, then submit"
                    shot={{ src: "use-03-submit.png", alt: "Reviewing the generated proposal before submitting on Upwork" }}
                  >
                    Read what Reflex wrote, change anything you like, attach the samples, and click{" "}
                    <b>Submit</b> yourself. Reflex saves the submission automatically so it shows on the job
                    board.
                  </Step>
                  <Step
                    n={4}
                    title="Reply to the client in seconds"
                    shot={{ src: "use-04-reply.png", alt: "A client conversation showing the job and client name with a Generate reply button" }}
                  >
                    In a client conversation, Reflex shows the <b>job and client name</b> and a{" "}
                    <b>Generate reply</b> button. It reads the whole conversation, the job, and the proposal
                    you sent, then drafts a reply you can tweak and send.
                  </Step>
                </Card>
              </div>

              <Note tone="warn" icon={<RXIcons.dot size={15} />}>
                <b>Some jobs won't show an "Add to Reflex" button — that's normal.</b> Reflex regularly pulls
                jobs straight from Upwork into our database on its own. If a job is already one of those, we
                already know its relevance and fit, so there's nothing to add — it's saved for you. You'll
                only see <b>Add to Reflex</b> on jobs that aren't in our system yet.
              </Note>

              <Note tone="info" icon={<RXIcons.spark size={15} />}>
                <b>You're always in control.</b> Everything Reflex does happens because you clicked. It reads
                the page and drafts for you — it never applies, sends, or submits on its own.
              </Note>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
