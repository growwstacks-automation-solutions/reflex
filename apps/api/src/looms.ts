// Loom helpers shared by /generate (cover-letter placeholder fill) and the draft writer
// (asset linking). The matcher stores looms as "Title — URL" (em-dash + URL).

/** Split a stored loom string ("Title — URL") into a label + url. Tolerates a bare URL. */
export function parseLoom(raw: string): { label: string; url: string } {
  const s = String(raw || "").trim();
  const m = s.match(/https?:\/\/\S+/);
  if (m) {
    const url = m[0];
    const label = s.slice(0, s.indexOf(url)).replace(/[—–-]\s*$/, "").trim() || "Loom walkthrough";
    return { label, url };
  }
  return { label: "Loom walkthrough", url: s };
}

/**
 * Substitute the cover letter's loom placeholders with the real matched looms.
 *
 * The prompt makes the model emit exactly two verbatim placeholder lines
 * ("[LOOM_TITLE_1] — [LOOM_LINK_1]", "[LOOM_TITLE_2] — [LOOM_LINK_2]") and leaves the actual
 * titles/links to us — so the model never invents Loom URLs. Here we fill slots 1 & 2 from the
 * matched `looms` (top 2). If fewer than two matched, any still-unfilled placeholder LINE is
 * removed so no "[LOOM_LINK_2]" leaks into the letter the rep copies.
 */
export function fillLoomPlaceholders(coverLetter: string, looms: string[]): string {
  const parsed = (Array.isArray(looms) ? looms : []).filter(Boolean).map((l) => parseLoom(String(l)));
  let text = String(coverLetter || "");
  for (let i = 0; i < 2; i++) {
    const item = parsed[i];
    if (!item) continue;
    text = text.split(`[LOOM_TITLE_${i + 1}]`).join(item.label);
    text = text.split(`[LOOM_LINK_${i + 1}]`).join(item.url);
  }
  // Drop any line still holding an unfilled loom placeholder (fewer than 2 matched), then
  // collapse the blank lines that removal may leave behind.
  return text
    .split("\n")
    .filter((line) => !/\[LOOM_(?:TITLE|LINK)_\d\]/.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
