/* Reflex portal — Phase 2 stub for the notification bell.
   Renders the bell button + unread badge so the board header is complete.
   The full deep-linking popup (BellPopup) replaces this in Phase 3. */
import type { ActionLink } from "@/lib/types";
import { RXIcons } from "@/components/icons";
import { RX_DATA } from "@/lib/mock-data";

export function BellButton({ onNavigate }: { onNavigate?: (link: ActionLink) => void }) {
  void onNavigate; // wired to the popup in Phase 3
  const count = RX_DATA.importantActions.length;
  return (
    <button
      title="Notifications"
      style={{
        position: "relative",
        width: 34,
        height: 34,
        borderRadius: "var(--radius-button)",
        border: "1px solid var(--border)",
        background: "var(--surface)",
        color: "var(--text-secondary)",
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
      }}
    >
      <RXIcons.bell size={16} />
      {count > 0 && (
        <span
          style={{
            position: "absolute",
            top: -4,
            right: -4,
            minWidth: 16,
            height: 16,
            padding: "0 4px",
            borderRadius: 999,
            background: "var(--accent)",
            color: "#fff",
            fontSize: 10,
            fontWeight: 600,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          {count}
        </span>
      )}
    </button>
  );
}
