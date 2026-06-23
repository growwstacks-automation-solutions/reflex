# Upwork anchors — Reflex extension

The verified DOM selectors the content script attaches to on each Upwork page. **All captured and confirmed on the live site** (counts checked in the Console). These are the injection/read points for the extension; hand this file to Claude Code alongside the build guide.

> Note: Upwork uses `air3-*` and `css-*` classes that change between deploys — those are avoided here. Every selector below uses a stable `data-*`, `aria-*`, `role`, or editor-framework class. If Upwork redesigns and one breaks, re-capture just that one anchor (right-click → Inspect → verify count in Console) and re-point it. The content script already runs injection inside a `MutationObserver`, so late-loading SPA content is handled.

---

## Anchor 1 — Job search results (inject per-row badge + "Add to Reflex")

```
Selector:  [data-test='JobTile']
Verified:  querySelectorAll → 10  (= all job rows on the page) ✓
```
One per job row. The extension injects the top-line indicators here (In Reflex ✓ / Relevant / owner like "Sarthak" / quality), pulled from the database. Read the job id from the row's `data-test-key` (or `data-ev-job-uid`) attribute.

---

## Anchor 2 — Job detail (read job data, dock panel) — covers BOTH layouts

```
Selector:  [data-ev-sublocation='jobdetails']
Verified:  querySelectorAll → 1 on the slide-over panel AND 1 on the full page ✓
```
Upwork has two job-detail layouts — a slide-over panel (URL `/nx/search/jobs/details/…` or `/nx/find-work/…`) and a full page (URL `/jobs/~02…`). This single selector matches the job-details region on both, so one anchor covers both.

---

## Anchor 3 — Proposal cover letter (fill the generated cover letter)

```
Selector:  textarea[aria-labelledby='cover_letter_label']
Type:      <textarea>
Verified:  querySelectorAll → 1 ✓
```
**Fill method (textarea):** a plain `.value =` won't register with Upwork's framework. Use the native setter + dispatch an input event:
```js
function fillTextarea(el, text) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set;
  setter.call(el, text);
  el.dispatchEvent(new Event('input', { bubbles: true }));
}
```

---

## Anchor 3b — Screening questions (DYNAMIC count — the important one)

A job may have **0, 1, or many** screening questions; the extension must handle any number.

```
Container:     .questions-area
  Verified:    querySelectorAll → 1 ✓
Answer boxes:  .questions-area textarea
  Verified:    querySelectorAll → 5 on a job with 5 questions ✓ (count matches the questions on screen)
```
**Pattern:** select the container, then loop over every `textarea` inside it. For each one, the **question text is its associated `<label>`** (read the label to know what's being asked), and the answer goes into that `<textarea>` using the same `fillTextarea` method as Anchor 3. This adapts automatically to however many questions the job has.

---

## Anchor 4 — Message composer (inject "Suggested reply", fill the reply)

```
Selector:  .composer [contenteditable='true']
Type:      contenteditable rich-text editor (Tiptap / ProseMirror)
Verified:  querySelectorAll → 1 ✓
```
**Fill method (contenteditable — NOT a textarea):** this is Upwork's Tiptap/ProseMirror editor. Setting `.value` or `.textContent` directly will **not** work — the editor manages its own internal state. Insert text the editor recognizes (e.g. focus the element and dispatch a `beforeinput`/paste with `inputType: 'insertText'`, or use a ProseMirror-aware insertion). Claude Code: treat this differently from the textarea anchors. Verify the inserted text actually persists in the editor (not just visually) before wiring the rest.

---

## Summary table

| # | Page | Selector | Type / fill |
|---|---|---|---|
| 1 | Search results | `[data-test='JobTile']` | per-row inject; read `data-test-key` |
| 2 | Job detail (panel + full) | `[data-ev-sublocation='jobdetails']` | read + dock |
| 3 | Proposal cover letter | `textarea[aria-labelledby='cover_letter_label']` | textarea — native setter + input event |
| 3b | Screening questions | `.questions-area` → `.questions-area textarea` (loop) | dynamic; label = question, textarea = answer |
| 4 | Message composer | `.composer [contenteditable='true']` | contenteditable (Tiptap) — editor-aware insert |

---

## How Claude Code uses this

Point it at `apps/extension`, give it `relay-extension-claude-code-guide.md` (the build guide) plus this file, and ask it to wire the content script to these real selectors. Anchors 1–3b fill via the textarea method; anchor 4 needs the contenteditable approach. Submission stays manual — the extension fills, the rep reviews and clicks Submit on Upwork.
