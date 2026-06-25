# Upwork DOM Anchors — Reflex extension

The verified selectors the content script anchors to on live Upwork pages. **All
verified in DevTools on the real site** (counts noted). The content script reads and
fills against these; it never auto-submits. If Upwork redesigns a page, re-point the
selector here first, then in `apps/extension/content/content.js` (the `ANCHORS` /
`SETTINGS` objects mirror this file).

> How these were captured: open the page → right-click the element → Inspect → prefer a
> stable `data-*` / `aria-*` attribute over generated `air3-*`/utility classes → verify
> the count in the Console with `document.querySelectorAll("<selector>").length`.

---

## Page anchors

### ANCHOR 1 — Job search results
- **Selector:** `[data-test='JobTile']`
- **Verified:** 10 rows on a results page ✓
- **Job id:** read from the tile's `data-test-key` (fallback `data-ev-job-uid`)
- **Use:** inject the top-of-card Reflex strip into every tile.

### ANCHOR 2 — Job detail (slide-over panel + full page)
- **Selector:** `[data-ev-sublocation='jobdetails']`
- **Verified:** 1 on **both** the slide-over panel and the full job page ✓
- **Use:** read the live job (title/description) + client stats; inject the detail strip.
- **Sub-selectors (best-effort, may need re-pointing):** title `h1, h2, h3, [data-test='job-title']`;
  description `[data-test='Description'], [data-test='job-description-text']`.

### ANCHOR 3 — Proposal cover letter
- **Selector:** `textarea[aria-labelledby='cover_letter_label']`
- **Type:** `<textarea>` — fill via the native value setter + dispatched `input` event
  (a plain `.value =` is ignored by Upwork's React layer).
- **Verified:** 1 ✓

### ANCHOR 3b — Screening questions (DYNAMIC count)
- **Container:** `.questions-area` (verified 1 ✓)
- **Answer boxes:** `.questions-area textarea` (verified 5 on a 5-question job ✓)
- **Use:** loop every textarea; read its `<label>` (or nearest label) = the question text;
  fill each answer the same way as the cover letter. Adapts to 0…N questions.

### ANCHOR 4 — Message composer
- **Selector:** `.composer [contenteditable='true']`
- **Type:** Tiptap / ProseMirror rich-text editor — **NOT** a `<textarea>`. Fill via an
  editor-aware insert (synthetic paste, fallback `execCommand('insertText')`), then verify
  the text persisted. Setting `.value`/`.textContent` will not stick.
- **Verified:** 1 ✓

---

## Proposal-page action selectors (verified on the apply page)

Used by the "Generate & prefill everything" button. Reflex fills these; the rep reviews
and clicks Upwork's own Submit.

### PROFILE RADIO
- **Selector:** `input[type='radio']` — 2 on the page ✓
- **Action:** select **Freelancer** = the **first** radio (`radios[0]`); agency = `radios[1]`.
- Set `checked` via `.click()` so the framework registers it.

### HOURLY RATE
- **Selector:** `#step-rate` (also `[data-test='currency-input']`)
- **Action:** set to `30` via native setter + `input`/`change` events.
- **Note:** this is the editable **bid-rate** input — NOT the read-only "You'll receive" field.

### RATE INCREASE — frequency (CUSTOM dropdown, not `<select>`)
- **Scope:** `[aria-label="How often do you want a rate increase?"]`
- **Toggle:** `[data-test='dropdown-toggle']` — **2 on the page** (frequency + percent), so
  scope to the frequency wrapper above and take the toggle inside it.
- **Action:** click the toggle to open, then click the option **row whose visible text is
  "Never"** (options render in `.air3-dropdown-menu-container`: Never / Every 3 months /
  Every 6 months / Every 12 months). Read by visible text, not position — robust to markup shifts.
- "Never" needs no percent — skip the percent dropdown.

### ATTACH FILES
- **Selector:** `input[type='file']` — 1 on the page ✓ (`accept="*"`, `multiple`)
- **Action:** fetch an asset URL → build a `File` → assign to this input's `files` via the
  native setter → dispatch `change`.
- **Note:** target the **hidden file input**, NOT the visible "Attach files" button
  (`data-ev-label='up_fe_attachment_selector_attach_files'`).
- **Pending:** real image attach needs real (R2/ImageKit) URLs + a host permission for the
  asset host; until then it falls back to "attach manually". (See PROGRESS known debt.)

---

## Fill methods (why a plain assignment fails)

Upwork is a React + Tiptap app, so writes must look like real user input:

- **`<textarea>` / `<input>`** (cover letter, screening, rate): use
  `Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value').set` (or the
  `HTMLInputElement` one), call it on the element, then dispatch `input` (and `change` for
  inputs). Verify `el.value === text`.
- **contenteditable** (message composer): dispatch a synthetic `paste` with a
  `DataTransfer`, fall back to `execCommand('insertText')`, then verify
  `el.textContent.includes(text)`.
- **custom dropdown** (rate increase): open the toggle, click the option by visible text.
- **file input** (attachments): set `.files` via the native `files` setter, dispatch `change`.
