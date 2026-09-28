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
