/* Reflex portal — Portfolio tab. Page-tabbed table of the `portfolios` table with full CRUD +
   drag-and-drop ordering. Pages are fixed chunks of 10 (mirroring Upwork's profile-highlights
   pages): inserting into a full page cascades the overflow to the next page; deleting compacts.
   Every change persists to Neon and the Worker rebuilds PORTFOLIO_INDEX from the DB. */
import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { PageHeader } from "@/components/Shell";
import { Button } from "@/components/ds/Button";
import { Card, Eyebrow } from "@/components/ui";
import { RXIcons } from "@/components/icons";
import { useAuth } from "@/lib/auth";
import {
  fetchPortfolios,
  createPortfolio,
  updatePortfolio,
  deletePortfolio,
  reorderPortfolios,
  UnauthorizedError,
} from "@/lib/api";
import type { Portfolio, PortfolioInput } from "@/lib/api";

const PER_PAGE = 10;

// First names allowed to create/edit/delete (mirrors the API's EDITORS gate). Everyone else views.
const EDITORS = ["manish", "sarthak"];

export function PortfolioScreen(): JSX.Element {
  const { token, user, signOut } = useAuth();
  const canManage = EDITORS.includes((user?.full_name ?? "").trim().toLowerCase().split(/\s+/)[0]);

  const [rows, setRows] = useState<Portfolio[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadKey, setReloadKey] = useState(0);
  const [activePage, setActivePage] = useState(1);
  // null = closed; { row: null } = add; { row } = edit.
  const [editing, setEditing] = useState<{ row: Portfolio | null } | null>(null);
  const [deleting, setDeleting] = useState<Portfolio | null>(null);
  const [busy, setBusy] = useState(false);
  const [dragId, setDragId] = useState<number | null>(null);
  const [overId, setOverId] = useState<number | null>(null);
  // Drag reorders are STAGED locally; `dirty` = there are unsaved order changes to Save.
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const totalPages = Math.max(1, Math.ceil(rows.length / PER_PAGE));
  const pageStart = (activePage - 1) * PER_PAGE;
  const pageRows = rows.slice(pageStart, pageStart + PER_PAGE);

  const fail = (err: unknown, fallback: string) => {
    if (err instanceof UnauthorizedError) return signOut();
    setError(err instanceof Error ? err.message : fallback);
  };

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchPortfolios(token)
      .then((list) => {
        if (cancelled) return;
        setRows(list);
        setDirty(false); // fresh from the server = the saved baseline
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) return;
        setLoading(false);
        fail(err, "Couldn't load portfolios.");
      });
    return () => {
      cancelled = true;
    };
  }, [token, reloadKey]);

  // Keep the active tab in range as the list grows/shrinks.
  useEffect(() => {
    if (activePage > totalPages) setActivePage(totalPages);
  }, [totalPages, activePage]);

  const onSubmit = async (input: PortfolioInput) => {
    if (!token || !editing) return;
    setBusy(true);
    try {
      const list = editing.row
        ? await updatePortfolio(token, editing.row.id, input)
        : await createPortfolio(token, input);
      setRows(list);
      setDirty(false);
      setEditing(null);
      setActivePage(Math.min(input.page_number, Math.max(1, Math.ceil(list.length / PER_PAGE))));
    } catch (err) {
      throw err; // surfaced inside the modal
    } finally {
      setBusy(false);
    }
  };

  const onConfirmDelete = async () => {
    if (!token || !deleting) return;
    setBusy(true);
    try {
      const list = await deletePortfolio(token, deleting.id);
      setRows(list);
      setDirty(false);
      setDeleting(null);
    } catch (err) {
      fail(err, "Couldn't delete the portfolio.");
    } finally {
      setBusy(false);
    }
  };

  // ---- drag-and-drop within the active page (staged locally until Save) ----
  const onDropOn = (targetId: number) => {
    setOverId(null);
    const from = pageRows.findIndex((r) => r.id === dragId);
    const to = pageRows.findIndex((r) => r.id === targetId);
    setDragId(null);
    if (from === -1 || to === -1 || from === to) return;
    const nextPage = [...pageRows];
    const [moved] = nextPage.splice(from, 1);
    nextPage.splice(to, 0, moved);
    // Re-slot the moved rows locally so #/Position refresh immediately in the array; Save persists.
    const next = [...rows.slice(0, pageStart), ...nextPage, ...rows.slice(pageStart + PER_PAGE)];
    setRows(next);
    setDirty(true);
  };

  // Commit the staged order: persist to the DB, re-sequence positions, and rebuild PORTFOLIO_INDEX.
  const saveOrder = async () => {
    if (!token) return;
    setSaving(true);
    setError(null);
    try {
      const list = await reorderPortfolios(token, rows.map((r) => r.id));
      setRows(list); // server-returned, re-sequenced positions
      setDirty(false);
    } catch (err) {
      fail(err, "Couldn't save the new order.");
    } finally {
      setSaving(false);
    }
  };

  // Throw away staged drags and reload the saved order from the DB.
  const discardOrder = () => {
    setDirty(false);
    setReloadKey((k) => k + 1);
  };

  const grid = canManage
    ? "34px 46px minmax(200px,2.4fr) minmax(150px,1.8fr) 84px 92px"
    : "46px minmax(200px,2.4fr) minmax(150px,1.8fr) 84px";

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
      <PageHeader
        title="Portfolio"
        subtitle="Manage the portfolio items used to match and recommend work in proposals."
        right={
          canManage ? (
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              {dirty && (
                <>
                  <span style={{ fontSize: 12.5, color: "var(--mon-orange)", fontWeight: 600 }}>Unsaved order</span>
                  <Button variant="ghost" onClick={discardOrder} disabled={saving}>
                    Discard
                  </Button>
                </>
              )}
              <Button
                icon={<RXIcons.check size={16} />}
                onClick={saveOrder}
                loading={saving}
                disabled={!dirty || saving}
                style={{ background: "var(--mon-green)", color: "#fff", border: "1px solid transparent", boxShadow: "none" }}
              >
                Save order
              </Button>
              <Button icon={<RXIcons.plus size={16} />} onClick={() => setEditing({ row: null })}>
                Add a new portfolio
              </Button>
            </div>
          ) : undefined
        }
      />

      <div className="rx-page-content" style={{ flex: 1, overflowY: "auto", padding: "20px 28px 40px" }}>
        {error && (
          <Card style={{ marginBottom: 16, borderColor: "var(--mon-red)", color: "var(--mon-red)" }}>
            {error}{" "}
            <button
              onClick={() => setReloadKey((k) => k + 1)}
              style={{ marginLeft: 8, background: "none", border: "none", color: "var(--accent)", cursor: "pointer", fontWeight: 600 }}
            >
              Retry
            </button>
          </Card>
        )}

        {/* Page tabs — one per Upwork page, 10 rows each. */}
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 14 }}>
          {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => {
            const on = p === activePage;
            const count = rows.slice((p - 1) * PER_PAGE, p * PER_PAGE).length;
            return (
              <button
                key={p}
                onClick={() => setActivePage(p)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 7,
                  padding: "7px 13px",
                  borderRadius: "var(--radius-button)",
                  border: on ? "1px solid transparent" : "1px solid var(--border)",
                  background: on ? "var(--indigo-500)" : "var(--surface)",
                  color: on ? "#fff" : "var(--text-secondary)",
                  boxShadow: on ? "var(--shadow-indigo)" : "none",
                  fontSize: 13,
                  fontWeight: on ? 700 : 500,
                  cursor: "pointer",
                }}
              >
                Page {p}
                <span
                  style={{
                    minWidth: 18,
                    padding: "0 5px",
                    borderRadius: 999,
                    fontSize: 11,
                    fontWeight: 700,
                    background: on ? "rgba(255,255,255,0.22)" : "var(--surface-2)",
                    color: on ? "#fff" : "var(--text-tertiary)",
                  }}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <Card pad="0" style={{ overflow: "hidden" }}>
          {/* Header row */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: grid,
              gap: 12,
              padding: "12px 18px",
              borderBottom: "1px solid var(--border)",
              background: "var(--surface-2)",
            }}
          >
            {canManage && <ColLabel />}
            <ColLabel>#</ColLabel>
            <ColLabel>Portfolio Title</ColLabel>
            <ColLabel>Tools Used</ColLabel>
            <ColLabel>Position</ColLabel>
            {canManage && <ColLabel style={{ textAlign: "right" }}>Actions</ColLabel>}
          </div>

          {loading ? (
            <EmptyState>Loading portfolios…</EmptyState>
          ) : rows.length === 0 ? (
            <EmptyState>
              {canManage ? (
                <>No portfolio items yet. Click <strong>Add a new portfolio</strong> to create the first one.</>
              ) : (
                <>No portfolio items yet.</>
              )}
            </EmptyState>
          ) : (
            pageRows.map((r, i) => {
              const globalNo = pageStart + i + 1;
              const positionInPage = i + 1;
              const isOver = overId === r.id && dragId !== null && dragId !== r.id;
              return (
                <div
                  key={r.id}
                  draggable={canManage}
                  onDragStart={canManage ? () => setDragId(r.id) : undefined}
                  onDragEnter={canManage ? () => setOverId(r.id) : undefined}
                  onDragOver={canManage ? (e) => e.preventDefault() : undefined}
                  onDrop={canManage ? () => onDropOn(r.id) : undefined}
                  onDragEnd={canManage ? () => { setDragId(null); setOverId(null); } : undefined}
                  style={{
                    display: "grid",
                    gridTemplateColumns: grid,
                    gap: 12,
                    padding: "13px 18px",
                    borderBottom: "1px solid var(--border)",
                    borderTop: isOver ? "2px solid var(--indigo-500)" : "2px solid transparent",
                    alignItems: "center",
                    fontSize: 13.5,
                    background: dragId === r.id ? "var(--surface-2)" : "transparent",
                    opacity: dragId === r.id ? 0.6 : 1,
                    cursor: canManage ? "grab" : "default",
                  }}
                >
                  {canManage && (
                    <span title="Drag to reorder" style={{ color: "var(--text-tertiary)", display: "inline-flex" }}>
                      <RXIcons.grip size={16} />
                    </span>
                  )}
                  <span style={{ fontFamily: "var(--font-mono)", fontWeight: 700, color: "var(--text-secondary)" }}>{globalNo}</span>
                  <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{r.portfolio_title}</span>
                  <span style={{ color: "var(--text-secondary)" }}>{r.tools_used}</span>
                  <span style={{ fontFamily: "var(--font-mono)" }}>{positionInPage}</span>
                  {canManage && (
                    <span style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <IconBtn title="Edit" onClick={() => setEditing({ row: r })}>
                        <RXIcons.edit size={15} />
                      </IconBtn>
                      <IconBtn title="Delete" danger onClick={() => setDeleting(r)}>
                        <RXIcons.trash size={15} />
                      </IconBtn>
                    </span>
                  )}
                </div>
              );
            })
          )}
        </Card>

        {!loading && rows.length > 0 && (
          <div style={{ marginTop: 12, fontSize: 12.5, color: "var(--text-tertiary)" }}>
            {rows.length} item{rows.length === 1 ? "" : "s"} across {totalPages} page{totalPages === 1 ? "" : "s"} · 10 per page
            {canManage ? (dirty ? " · unsaved order — click Save order to apply" : " · drag rows to reorder, then Save order") : ""}
          </div>
        )}
      </div>

      {editing && (
        <PortfolioForm
          initial={editing.row}
          defaultPage={activePage}
          defaultPosition={Math.min(pageRows.length + 1, PER_PAGE)}
          busy={busy}
          onCancel={() => setEditing(null)}
          onSubmit={onSubmit}
        />
      )}

      {deleting && (
        <ConfirmDelete row={deleting} busy={busy} onCancel={() => setDeleting(null)} onConfirm={onConfirmDelete} />
      )}
    </div>
  );
}

function ColLabel({ children, style }: { children?: ReactNode; style?: CSSProperties }) {
  return (
    <div
      style={{
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.04em",
        textTransform: "uppercase",
        color: "var(--text-tertiary)",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div style={{ padding: "40px 18px", textAlign: "center", color: "var(--text-secondary)", fontSize: 13.5 }}>
      {children}
    </div>
  );
}

function IconBtn({
  children,
  onClick,
  title,
  danger,
}: {
  children: ReactNode;
  onClick: () => void;
  title: string;
  danger?: boolean;
}) {
  const [hover, setHover] = useState(false);
  return (
    <button
      title={title}
      onClick={onClick}
      draggable={false}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      style={{
        width: 30,
        height: 30,
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        borderRadius: "var(--radius-button)",
        border: "1px solid var(--border)",
        cursor: "pointer",
        background: hover ? (danger ? "var(--mon-red)" : "var(--surface-2)") : "var(--surface)",
        color: hover ? (danger ? "#fff" : "var(--text-primary)") : "var(--text-secondary)",
        transition: "background 0.12s ease, color 0.12s ease",
      }}
    >
      {children}
    </button>
  );
}

/* ---- Modal shell ---- */
function Modal({ children, onClose }: { children: ReactNode; onClose: () => void }) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15,18,40,0.44)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
        zIndex: 50,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 520,
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "var(--radius-card)",
          boxShadow: "var(--shadow-lg, 0 20px 60px rgba(0,0,0,0.28))",
          overflow: "hidden",
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ---- Add / edit form ---- */
function PortfolioForm({
  initial,
  defaultPage,
  defaultPosition,
  busy,
  onCancel,
  onSubmit,
}: {
  initial: Portfolio | null;
  defaultPage: number;
  defaultPosition: number;
  busy: boolean;
  onCancel: () => void;
  onSubmit: (input: PortfolioInput) => Promise<void>;
}) {
  const [title, setTitle] = useState(initial?.portfolio_title ?? "");
  const [tools, setTools] = useState(initial?.tools_used ?? "");
  const [page, setPage] = useState(String(initial?.page_number ?? defaultPage));
  const [pos, setPos] = useState(String(initial?.position ?? defaultPosition));
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setErr(null);
    const pageN = Number(page);
    const posN = Number(pos);
    if (!title.trim()) return setErr("Portfolio Title is required.");
    if (!tools.trim()) return setErr("Tools Used is required.");
    if (!Number.isInteger(pageN) || pageN < 1) return setErr("Page Number must be a whole number ≥ 1.");
    if (!Number.isInteger(posN) || posN < 1 || posN > PER_PAGE) return setErr(`Position must be between 1 and ${PER_PAGE}.`);
    try {
      await onSubmit({ portfolio_title: title.trim(), tools_used: tools.trim(), page_number: pageN, position: posN });
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Couldn't save the portfolio.");
    }
  };

  return (
    <Modal onClose={onCancel}>
      <div style={{ padding: "20px 22px 10px" }}>
        <Eyebrow>{initial ? "Edit portfolio" : "New portfolio"}</Eyebrow>
        <h2 style={{ margin: "6px 0 0", fontSize: 19, fontWeight: 700, letterSpacing: "-0.02em" }}>
          {initial ? "Edit portfolio item" : "Add a new portfolio"}
        </h2>
      </div>

      <div style={{ padding: "8px 22px 4px", display: "flex", flexDirection: "column", gap: 14 }}>
        <Field label="Portfolio Title" required>
          <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="AI Gift Recommendation Engine" style={inputStyle} />
        </Field>
        <Field label="Tools Used" required>
          <input value={tools} onChange={(e) => setTools(e.target.value)} placeholder="Claude + FastAPI + Prompt Engineering" style={inputStyle} />
        </Field>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
          <Field label="Page Number" required>
            <input type="number" min={1} value={page} onChange={(e) => setPage(e.target.value)} placeholder="1" style={inputStyle} />
          </Field>
          <Field label="Position (1–10)" required>
            <input type="number" min={1} max={PER_PAGE} value={pos} onChange={(e) => setPos(e.target.value)} placeholder="1" style={inputStyle} />
          </Field>
        </div>
        <p style={{ margin: 0, fontSize: 12, color: "var(--text-tertiary)", lineHeight: 1.5 }}>
          Pages hold 10 items. Adding into a full page pushes the last item to the top of the next page.
        </p>

        {err && <div style={{ fontSize: 13, color: "var(--mon-red)", fontWeight: 500 }}>{err}</div>}
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "16px 22px 20px" }}>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={submit} loading={busy}>
          {initial ? "Save changes" : "Add portfolio"}
        </Button>
      </div>
    </Modal>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: "var(--text-secondary)" }}>
        {label}
        {required && <span style={{ color: "var(--mon-red)" }}> *</span>}
      </span>
      {children}
    </label>
  );
}

const inputStyle: CSSProperties = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: "var(--radius-button)",
  border: "1px solid var(--border)",
  background: "var(--canvas)",
  color: "var(--text-primary)",
  fontSize: 14,
  fontFamily: "var(--font-ui)",
  outline: "none",
};

/* ---- Delete confirm ---- */
function ConfirmDelete({
  row,
  busy,
  onCancel,
  onConfirm,
}: {
  row: Portfolio;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  return (
    <Modal onClose={onCancel}>
      <div style={{ padding: "22px 22px 8px" }}>
        <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700 }}>Delete this portfolio item?</h2>
        <p style={{ margin: "10px 0 0", fontSize: 13.5, color: "var(--text-secondary)", lineHeight: 1.5 }}>
          “{row.portfolio_title}” will be permanently removed and dropped from the proposal matching
          list. Remaining items shift up to keep pages full. This can't be undone.
        </p>
      </div>
      <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, padding: "16px 22px 20px" }}>
        <Button variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
        <Button onClick={onConfirm} loading={busy} style={{ background: "var(--mon-red)", boxShadow: "none" }}>
          Delete
        </Button>
      </div>
    </Modal>
  );
}
