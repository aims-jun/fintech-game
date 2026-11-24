# AIMS Paper Race — implementation plan

**Goal:** A polished, offline booth game in which visitors race a simulated AI by finding mismatches in fictional insurance documents.

**Architecture:** HTML/CSS/JavaScript with no runtime dependencies. A pure state engine and local browser store support a participant view and an operator view. A Python launcher provides a stable local origin and disables caching. jsdom is a development-only dependency for nonvisual DOM event tests.

**Spec:** This document records the accepted brief from the conversation. This is a complete redesign, not an overlay on earlier CSS.

## Global constraints

- White and black booth aesthetic; restrained warm signal colour only for interaction and urgency.
- One visual focus: two realistic documents. No dashboards or multiple explanatory panels on the player screen.
- Entire player experience fits landscape desktop viewports, including 1280 × 650, 1366 × 768 and 1920 × 1080.
- Equal typography and hover for every document value. No answer-only hotspots.
- Three rounds, progressing through easy comparison, money/count comparison and repeated-record review. Version 5.1 selects these from 18 scenarios across six types.
- Three-second opening countdown; tactile selections, animated evidence connection, transition and result.
- Default race 45 active seconds; easy 60, hard 32. AI completes at the displayed deadline. Reveal and pause freeze both players.
- Simulator is labelled; no claims about actual AIMS speed, accuracy, insurance eligibility or fraud.
- Local scores and CSV; no external API, tracking, personal information or remote assets.
- One PC, same browser profile and origin for display/operator. Reload must retain active session.

## File boundaries

- `index.html`, `arena.css`, `app.js`: participant scenes, motion and interaction.
- `cases.js`: original fictional fixtures for legacy session compatibility.
- `casebook.js`: deterministic scenario bank, preview API and versioned session IDs.
- `documents.js`, `documents.css`: shared renderer and six fictional form formats.
- `engine.js`: pure time/state logic and shared local persistence.
- `operator.html`, `operator.css`, `operator.js`: event controls and scores.
- `server.py`, `start.command`, `start.bat`: local launch and cache/port handling.
- `tests/`: timer, persistence, launch, HTML parsing and simulated two-context integration checks.

## Review focus

1. A result cannot change while the winning animation is playing.
2. Opening another window or refreshing cannot restart the current game.
3. Pausing freezes countdown, play and the between-round animation.
4. Short desktop windows must not cut off documents or controls.
5. All selectable values must look equivalent before selection; wrong guesses must be handled without leaking answers.

## Implementation

- [x] Build and test engine with deadline, pause and multi-window safeguards.
- [x] Rebuild opening, tutorial, game and result as a coherent visual system.
- [x] Build operator controls using the same engine and keep form inputs stable.
- [x] Add launcher and test occupied ports/no-cache behavior.
- [ ] Live-browser visual verification is blocked in this environment. Desktop geometry was reviewed statically; actual rendering, animations and native Mac/Windows execution remain unverified.
- [x] Independently review, package and deliver the verified files.

## Decisions

- The user's repeated requests to proceed authorize implementation without another design approval.
- The countdown expresses the opponent's completion deadline, so the visible timer and actual finish agree.
- The intended visual gate is live rendering; it remains blocked in this environment. Automated tests cover behavior and source structure, not actual browser appearance.
- A separate operator page keeps event controls away from the public display.

## Verification record

The following records the original v5 release. The 5.1 checks are recorded below.

- 32 Node behavioral tests pass: reducer timing, scoring, evidence fixtures, stale commands, cross-window serialization, persistence, and CSV escaping.
- 16 Python tests pass: port conflicts/reuse, cache handling, server identity, required asset/DOM references, and offline archive integrity.
- `app.js` and `operator.js` syntax checked; generated standalone script syntax checked before release.
- A separate reviewer checked cases, equal click targets, tutorial reset, deadline/reveal behavior and visible/raw round boundaries.
- Corrected early hint/mistake penalties with a failing regression test, then verified the full suite.
- Operator controls and live documents fit the desktop layout; rankings moved to a dialog. Small displays use a responsive alternate layout. This is a CSS design claim, not a browser screenshot verification.
- Brand description source: https://www.aimskr.com/autocapture . No speed/accuracy figures are used as gameplay claims.

## Version 5.1 — casebook and paperwork

### Scope and decisions

- Keep the accepted overall visual system, countdown, motion, scoring and local storage.
- Add 18 fictional scenarios: three each for dates, names, totals, quantities, repeated line items and repeat receipt submissions.
- Pick one scenario from each of three groups using a deterministic `book1-` session seed. Both windows and reloads reconstruct identical documents. Existing unprefixed sessions use the unchanged legacy fixtures until the next game.
- Keep each new document at seven selectable fields: two identity cells in one band, four body rows and one summary. Every value has the same 400 weight and selection behavior; form-specific decoration never depends on the answer.
- Use distinct claim, receipt, detail, confirmation, procedure-record and submission-history layouts. Include fictional filing numbers, fine rules, seals, issuance language and a bundled serif title font without copying tiny legal or medical forms.
- Keep target evidence in selectable fields; avoid repeating it in small print or signatures. Long operator values wrap rather than truncate the meaningful end of receipt IDs.
- Add an operator-only catalog dialog with all 18 previews, data variants and answer explanations. Previewing cannot start a game, change the active seed or affect scores; the dialog closes when a game starts.
- Keep `server.py` build identity `arena5` and the existing filenames so same-folder launcher reuse and local-storage origin continuity remain intact. Visible edition labels identify 5.1.

### Verification

- Final regression: 61 Node tests and 16 Python tests passed with zero failures. The three bundled Korean fonts include all 426 Korean syllables present in the source content.
- Casebook tests cover all 18 templates, evidence pairs, date chronology, monetary arithmetic, unit/count consistency, legacy continuation, deterministic reconstruction, preview isolation and real-engine solutions.
- Shared renderer tests parse actual markup for equal selectable targets, separate identity wrappers, allowed kinds/zones, unique accessible names and escaped untrusted text.
- Integration checks use separate store contexts for operator/player consistency, paused reload, session variation and old-session continuation; entry-page order and embedded standalone code are checked as well.
- The independent document reviewer checked all 18 scenarios and resolved heading-schema alignment, repeated monetary metadata and supporting document titles.
- Browser rendering and native Mac/Windows execution remain unverified. CSS has been sized for the established landscape desktop viewports, but source checks are not a visual test.

## Version 5.2 — printed form layouts

**Request:** Make the paperwork itself convincingly resemble real printed documents. Preserve the accepted game shell and its readable values.

**Plan:** Replace the shared card-like inner skeleton with six print structures: a boxed application with numbered sections and a signature line; a receipt with grouped payment rows and issuer cells; an aligned code/item/basis/value ledger; a formal certificate with centered title and attestation; a procedure log; and an administrative filing report. Use original fictional wording, black rules, consistent normal-weight selectable values, and one quiet exhibition notice per form. Do not copy real logos, personal data, legal notices or extra monetary claims.

**Implementation:** Rewrite only the presentation in `documents.js` and `documents.css`, retain render/export APIs and all evidence IDs, update the operator preview overrides, bundle fonts covering the new labels, and label both entry points 5.2. No game or seed changes.

**Checks:** Preserve existing escaping/evidence/legacy tests, add a structure check for the six actual markup shapes, run the established behavior and packaging suites, rebuild both existing deliverables, and replace their saved versions. Browser rendering remains blocked; do not substitute an unverified visual claim.

**Visual references:** https://www.samsungfire.com/download/claim/claim_new.pdf ; https://m.lina.co.kr/upload/docs/claim/exam/medical_expense_detail.pdf ; https://www.law.go.kr/LSW/flDownload.do?bylClsCd=110202&flSeq=150272955&gubun=

**Verification result:** 63 Node tests and 16 Python tests pass. Added checks distinguish all six markup structures even after removing text/classes/decorations, validate one fictional-form notice and exactly the intended interactive fields, and exercise hostile strings through every form in both views. Quantity-only detail forms use three columns without an empty calculation-basis column; missing clinical codes show a dash, never an invented code. CSS rule delimiters and both rebuilt entry points are checked statically. These checks do not establish pixel-level fit or browser visual quality.

## Version 5.3 — source-based form tables

The user rejected the preceding designs as insufficiently faithful to real paperwork and explicitly requested internet research. Fresh searches located official insurer/public forms. The new implementation uses their actual table relationships rather than the previous common7-row presentation. `FORM-REFERENCES.md` records the source URLs, the observed structure, the adaptation and inspection limits.

- `hospital-forms.js`: semantic receipt expense/settlement tables and a12-column detail statement, with rowspan/colspan headers. Receipt categories use the paired detail services when available; otherwise amounts remain in a labeled unclassified aggregate. Added insurer balances are fictional, not medical reimbursement rates. Original patient amounts and evidence IDs are retained.
- `documents.js`: cell-level controls, a4-section claim application, certificates/logs/registers, semantic legacy grouping, stable neutral context fields and a source-reference API. Each clickable wrapper owns exactly one control, even when a table row contains several selectable cells.
- Quantity comparisons now put unit price, count and line amount into separate cells of one service row. Monetary values in receipt/detail cells omit their 원 suffix visually, with raw values retained in data-value and accessible labels.
- The operator case preview links directly to the public original PDFs for the supported reference-backed formats. Other three formats are original fictional forms, not claimed copies of institutional records.
- The module is loaded in both entry pages and embedded offline before documents.js. Core engine, scores and case seeds are unchanged.
- New tests validate complete nonoverlapping table grids and legal nesting, column/header relationships, stable context IDs across both views and reloads, original evidence preservation, safe string escaping and quantity-cell placement. This replaces the inadequate old test of generic markup distinctness.
- Actual browser rendering remains blocked; PDF screenshot calls returned reference markers without image pixels. Neither is represented as visual verification.

**Final behavior/structure verification:** 66 Node tests and 16 Python tests passed, with zero failures or skips. Paired receipt checks independently map source services to categories and reconcile covered/noncovered totals. Two reproduced synthetic-insurer alias regressions are covered. New neutral context values remain stable across views and paused reloads. Final browser appearance is not verified by these tests.


## Version 5.4 — Korean receipt photographs

The participant request is to use actual Korean hospital and pharmacy receipt photographs, with fictional identities and monetary information. The approved booth shell, local scores, clock and local launcher remain in place.

- Two source-based photo templates are in assets/receipt-hospital-photo.png and assets/receipt-pharmacy-photo.png. Their source URLs, editing scope and limitations are in FORM-REFERENCES.md. No downloaded originals or original personal records are included in the release.
- receipt-photos.js places live HTML fields inside SVG foreignObject elements using the image coordinate system. One DOM control owns each original field; raw IDs/values remain the evidence contract. Operator and participant use the same renderer.
- receipt-photos.css scales the whole photo and its hit regions together inside the existing bounded document stage. There is no answer-dependent font weight.
- Hospital category projection follows the paired detail sheet. Repeated derived payment values are left blank to avoid a second clickable copy of an answer amount. Pharmacy totals distinguish gross medicine cost from the patient's payment.
- Three new pharmacy scenarios bring the catalog to 21. New book2 sessions include hospital and pharmacy photos in the three-round sequence. Original book1 data and seeded selections are sealed by pre-edit hash fixtures.
- build.py embeds the two PNGs alongside fonts, styles and scripts in the standalone HTML; the ZIP contains editable source and offline assets. Both entry pages show 5.4.

Validation is source, data and engine based. Browser execution was blocked earlier in this environment, and no alternate renderer was used to bypass that restriction. Final pixel alignment, physical-monitor readability and native launcher interactions remain outside the automated verification boundary.

## Version 5.5 — photo selection and preview interaction

**Reported failure:** The user liked the receipt images but could not click anything. Inspection reproduced an explicit cause in the operator case preview: all rendered values were disabled and no preview selection handler existed. Live-game photo buttons did have listeners, so an unverified browser-specific cause is not asserted. At small sizes the previous photo targets were also very small.

- Replace SVG foreignObject controls with ordinary HTML buttons over an HTML image. The image and overlay share one fitted rectangle, using the original photo coordinates. Original field IDs, raw values, photo files, case seeds, scores and timing are preserved.
- Show the same quiet underline on every selectable photo value. No answer-dependent weight or hover style is introduced.
- Add 2.5× receipt zoom, blank-area dragging, wheel/arrow-key panning and a full-view/Esc reset. The receipt remains inside its existing bounded stage; no page scrolling is added. ResizeObserver keeps the fitted image and overlay together.
- Geometry changes notify the participant page during answer reveal. The evidence connector follows zoom/pan without replacing its SVG nodes or restarting its reveal animation; ordinary game ticks do not redraw it.
- Enable case-preview fields and handle selection locally. A correct pair reveals its explanation; a wrong pair clears immediately. Changing the scenario or variant resets preview state. Preview interaction never writes the live game or scores.
- Run real app.js and operator.js event listeners in jsdom, with DOM clicks through all three rounds, hospital and pharmacy photos, countdown, pause/resume, reveal and preview controls. Separate geometry tests cover zoom/pan/resize. This is nonvisual verification, not browser rendering or pointer hit testing.
- Development tests are reproducible with `npm ci` then `npm test`; the offline game needs neither Node.js nor these dependencies. The release builder excludes installed development packages.

**Verification limit:** Browser execution remains unavailable in this environment. No claim is made that the user's browser-specific symptom or final physical-monitor click placement has been reproduced visually.

**Final automated verification:** 88 Node tests and 16 Python tests passed, with no failures or skips. Both receipt PNGs are byte-for-byte identical to the 5.4 delivery. All Korean syllables used by the page scripts are included in the bundled Korean fonts.


## Version 5.6 — photographed claims, itemized sheets and centered instructions

**Request:** Make the claim sheet photo-like as well, repair the broken itemized sheet using real Korean source material, and center the what-to-find instruction.

**Source check:** The official Samsung Fire blank claim PDF and Lina medical-detail PDF were downloaded and their rendered pages inspected. The latter combines front and back on one PDF page; only the front is used as the image reference. Adapted photographs are fictional exhibition forms, not claimed original issued records. Sources and edit scope are in FORM-REFERENCES.md; image prompts are in FORM-PHOTO-PROMPTS.md.

**Diagnosis boundary:** No malformed 12-column markup or missing original detail field was found. The old layout independently sized a full-height flex table, viewport-clamped fonts, nowrap numeric cells, and surrounding bands inside a narrow pane. These source-level sizing constraints make reflow fragile; the user's exact browser overflow was not visually reproduced. A stale document-v2 mobile-preview selector was also corrected to document-v4.

- form-photos.js uses the existing shared ordinary-HTML photo canvas and zoom/pan behavior for all claim and detail fixtures, including legacy sessions. All original IDs and values remain once; role suffixes survive escaped/untrusted display strings.
- form-photos.css scales text and controls with native coordinates. Detail cases receive 1.45:1 relative width on desktop; zoom remains available in either view. No new page-level scrolling is introduced.
- Quantity unit/count/amount share one line. Original duplicate descriptions and times remain visible, and billing-category classification matches the paired receipt. Full category labels wrap within their narrow printed cells.
- Main round label, title and instruction are centered in a compact stack. Operator heading/instruction and case-preview intro are centered too. Existing scene-height budgets are preserved.
- Both entry points and standalone build include the new module, stylesheet and two photo assets. Visible edition and cache tags are 5.6; local storage, scores, seeds and timing remain compatible.

**Verification scope:** Static source images were inspected. Automated checks exercise native coordinate bounds, nonoverlapping hit regions, field preservation, escaping, category/accounting relationships, actual app/operator DOM clicks, and byte-identical embedded images. Browser rendering, pointer hit testing and physical-display readability remain unverified because browser execution is restricted in this environment.

**Final 5.6 verification:** 92 Node tests and 16 Python tests passed with no failures or skips. Five stylesheets parsed successfully. The two existing receipt PNGs remain byte-identical to5.5. New claim/detail field boxes and service-description font metrics were checked against their native image geometry, without representing these checks as browser rendering.

## Version 5.7 — bounded sheets and like-for-like comparisons

**Reported problems:** The screenshot shows the history table extending beyond its paper and into the score/footer. The user also challenged comparing insurance claim amounts directly with medical payments.

**Layout cause and fix:** The history registration table used `height:100%` plus `flex:1`, even though patient information, headings, attachments, summary and signature were siblings. All remaining HTML document kinds now have one native-width sheet containing their full header, content and footer. Natural offset/scroll dimensions, including a two-pixel edge guard, feed the existing fitter. Scoped styles remove the percentage-height competition. The sheet and its viewport are observed independently; font completion also triggers fitting. A changed scale emits the layout event even if the outer rectangle is unchanged. All existing values, selection handlers and zoom/pan controls remain live. Small auto-height operator layouts reserve actual grid row height. Receipt text now scales without independent minimum font sizes that could spill outside its native cells.

**Comparison changes:** The official receipt separates gross medical charges, insurer share, patient burden, prior payments and current payment. The new cases compare the same fields for the same encounter:

- Hospital amounts: detail noncovered subtotal versus receipt noncovered subtotal. Both target the printed noncovered sum row, not gross charges or paid amount. Cases assume final settlement with no adjustment, refund or discount.
- Pharmacy amounts: original receipt payment versus the same receipt's intake input record. Patient, pharmacy, dispensing date and receipt number match; the deliberately different number is a transcription error. The paired sheet is clearly an internal input record, not an insurance benefit calculation or an invented medical certificate.
- Claims: use filing type instead of an arbitrary claim amount. The home-page sample follows the same wording.
- Quantities: one explicitly noncovered service has unit price × count × one day. Its amount and subtotal belong in the noncovered column. The matching performed record has the same date, code, item and time.
- Repeated services: the patient-share sum belongs in the patient-share column. Instructions ask for the two selectable amounts with matching code/item/time, with a once-only record as context.
- Repeated receipts: show original treatment/dispensing date separately from reception date. The explanation calls for reissue or supplementary-submission review, not a fraud conclusion.

**Compatibility:** Add `book3-` sessions and current preview APIs while preserving all `book1`/`book2` source fixtures and seeded selections. New games and operator previews use the improved bank; already running saved games retain their original evidence. Frozen book2 hashes match the pre-edit audit. All 21 current situations remain reachable; three-round games still include hospital and pharmacy receipts. Release labels/cache versions are5.7, and all four source photo assets are unchanged.

**Verification:** 117 Node tests and 16 Python tests pass, with no failures or skipped tests. Current cases are covered by generated-data assertions, actual participant/operator DOM event handlers, archived-session hashes, original-field uniqueness, printed column placement and native image bounds. Full-sheet tests inject explicit natural dimensions and viewport sizes, including late font/content growth, and verify the full extent stays within its pane. All 369 Korean source syllables are covered by bundled fonts. These are nonvisual checks. Actual browser layout, native pointer hit testing and physical-monitor readability remain unverified because browser execution is restricted in this environment.
