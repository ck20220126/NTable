# Column drag visual QA — 2026-09-27

Scope: the requested single-column drag interaction, not a full-page clone.

## Evidence
- Source: qa/feishu-column-drag.png, captured from the referenced live Feishu table while dragging (1470 × 1244 output pixels).
- Implementation: qa/local-column-drag.png (1280 × 720 output pixels); local viewport 1280 × 720 CSS pixels.
- Combined full-view evidence: qa/column-drag-comparison.png.
- Combined focused evidence: qa/column-drag-detail.png. Header rows are aligned and crops preserve native pixels; different field widths, data, record count and app chrome are intentional. The reference capture reports a different CSS width from its output image, so these captures establish interaction/style correspondence, not a whole-page pixel-diff certification.
- Short-table endpoint evidence: qa/local-short-table-drag.png.

## Findings and fixes
1. P1: native HTML dragging plus a floating titled header produced moving content. Replaced with pointer capture and an empty gray column mask. The actual headers/cells keep their coordinates and ordering until drop.
2. P2: old source cells had blue borders and the header had an elevated shadow. Replaced with one pale blue source overlay, matching reference behavior.
3. P2: source header initially appeared darker than source body. Set its base background to white; recaptured and compared the final combined images.
4. P2: target selection depended on entering a header. Drop slots now follow column midpoints across the grid body; only a real move displays the blue insertion line.

## Fidelity surfaces
- Typography/copy: the moving overlay contains no text or icons; original content remains stationary and readable. Existing business schema labels are retained.
- Layout: mask keeps the source width and original pointer offset, stays vertically aligned to the sticky header, and stops at the last data row or viewport edge. No floating header or shadow.
- Colors: source uses rgba(51,112,255,.12), mask rgba(31,35,41,.05), insertion line #1456f0 at 2px. Source screenshot dominant blue is approximately RGB(231,238,254); implementation RGB(231,238,255), within capture rounding.
- Assets: no duplicated raster/header/cell assets in the drag preview; existing schema icons stay in place.
- Content: intentional business-data and column-width differences; this pass does not certify unrelated existing cell renderers or full-page typography.

## Browser verification
- During drag, overlay textContent is empty and header order is unchanged.
- Rightward drop changes order only on pointer release; leftward drag restores it.
- Escape removes overlays without changing order.
- Right-edge drag scrolls to scrollLeft 211 (the measured maximum); cancelling preserves order.
- Filtering to three rows yields overlay bottom 212 and virtual-body bottom 212 exactly.
- Console error log empty.
- Vite production build passed.
- Preview restored to original column order with search cleared.

No remaining P0/P1/P2 finding in the scoped mask-drag behavior. Native touch hardware and screenshot-exact whole-page identity are not certified by this run.

final result: passed

# Hierarchical row fidelity QA — 2026-09-28

Scope: the first-field hierarchy and child-row styling requested in the browser comment.

## Reference and result

- Inspected the existing Feishu inventory table in the in-app browser in expanded and hovered states. Reference capture uses native screenshot pixels; the 48px browser capture offset is excluded when comparing page geometry.
- Local result: `qa/child-rows-aligned.png`; child hover: `qa/child-rows-hover.png`.
- Each row is 32px tall and each hierarchy level adds 22px. The field text starts 20px after its toggle center.
- The hierarchy guide is 2px wide, with 2px painted / 2px clear at RGB(238, 239, 241). It starts 20px below the expanded parent row's top and stops at the last child's midpoint.
- Child separators are RGB(222, 224, 227), begin 12px to the right of the parent guide, and leave the row-number gutter uncut. The gutter has no vertical separator.
- A normalized pixel comparison passed for the complete two-child guide, both child separators, and the uncut gutter. Business text, column widths, and SVG-versus-canvas glyph antialiasing are not covered by that pixel-equality check.
- Hover uses RGB(244, 244, 244), reveals add-child and open-record controls, and separates parent counts from the add button with a vertical rule. Selection remains blue while hovered.

## Interaction and regression checks

- Created temporary third-level records in a separate local preview tab: ancestor guides continue through a non-final sibling, while a final sibling's guide ends at its center and does not continue through its descendants.
- Collapsing the root hid all four test descendants; expanding restored all four.
- Child selection updated the footer count; the open-record button opened the existing fullscreen editor; adding a child expanded its parent.
- Horizontal scrolling reached 141px while the frozen first field remained at x=42px. Frozen and ordinary cells all measured 32px high.
- Browser console errors: none. The temporary preview tab was closed; the user's original table state was preserved.
- Final production build, all four Sites packaging tests, and `git diff --check` passed.

# Filter fidelity QA — 2026-09-29

Scope: existing filter panel and all/any interactions. Reference: live Feishu inventory table in the existing in-app browser. This is the agreed functional subset: no AI section; retain user-requested 清空, 筛选条件, 任意, 添加筛选条件 wording, 2px condition padding, 8em label truncation, and danger delete hover.

## Evidence and normalization
- Source full capture: `/private/tmp/feishu-filter-reference.png`.
- Final implementation full capture: `/private/tmp/local-filter-reference.png`.
- Combined focused comparison: `/private/tmp/ntable-filter-comparison.png` (source left, implementation right). Crops align the panel, excluding the source AI footer; differing business fields and labels are intentional.
- Both captured images are 1872×1228 pixels. Browser CSS viewport is 1946×1228, DPR 2; built-in screenshot output is rescaled and includes browser top padding. Use identical screenshot scale for the combined visual comparison; exact dimensions below are DOM CSS pixels, not screenshot pixels.

## Findings and correction history
- P1: all/any originally reused a 28px bordered selector. Fixed to a 56.5625×22px borderless trigger with 4px horizontal padding, 4px gap, 12px chevron in a 16px slot, hover/open neutral background. Source measured 56.5625×22px.
- P2: dropdown was too wide and used blue filled selection. Fixed compact 30px options, blue text/check, neutral hover/focus fill. All/any exposes no redundant label tooltip.
- P2: field chooser lacked search and field icons. Added a 212px popup, search, scrollable 36px options, selected check, and empty search feedback. Long labels retain the full source value and use the requested CSS 8em ellipsis with full-label tooltip.
- P2: panel title/spacing and row controls drifted. Fixed 516px panel, 16px inset, 14px/500 title, 32px row controls, 8px inter-control gap, content-sized field/operator triggers. Requested 2px row padding accounts for minor row-position differences from the source.
- P2: arrow keys did not navigate option buttons. Added ArrowUp/Down/Home/End navigation; Enter selects and closes. Escape closes the current nested menu and keeps its parent panel.
- Post-fix combined screenshot inspected: no remaining actionable P0/P1/P2 differences within this scoped subset. Lucide icons follow the established project icon set; exact Feishu glyph paths and private fonts are not claimed identical.

## Verification
- Browser: keyboard all → any updates and closes menu; OR returned 10,040 rows and AND returned 0 for two deliberately disjoint conditions. Blank test values cleared afterward.
- Browser: field search 数量 returns exactly one option and an icon; unmatched query displays 无匹配字段; Escape closes only the field menu.
- Browser: empty operator removes value input, preserves right-aligned delete (2px inset), and switching back gives an empty input.
- Browser: removing the second blank condition hides conjunction at one row; adding it shows default 所有. Restored the original two blank conditions and 所有 mode.
- Browser: 任意 persists after closing/reopening the panel, then restored 所有. Info hover displays the required text. No error-level console logs.
- Four automated filter tests pass: AND/OR/default, incomplete OR conditions, empty/zero, numeric comparisons and operator availability.
- `npm run build` and `git diff --check` pass. The pnpm launcher stalled before running a script, so the same package build script was run through npm.

final result: passed

## Radix Tooltip verification — 2026-09-29

- Replaced manual select-label positioning and CSS-only info visibility with shared `@radix-ui/react-tooltip` wrapper.
- Browser verified: info and select trigger show full text above; option hover shows full text on the right; Escape dismisses the info tooltip while retaining the filter panel; opening a selector dismisses its trigger tooltip and preserves field search.
- `npm run build`, four filtering tests, and `git diff --check` passed.
- Screenshot: `/private/tmp/ntable-radix-tooltip.png`.
