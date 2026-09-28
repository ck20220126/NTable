# Prototype Instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local prototype can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Product decisions

- Export ViewBar, TableToolbar, and Table from separate TSX files; NTable only composes these three. Toolbar panels have their own files. Keep table headers and cells within Table rather than fragmenting every table element.

- React components use TSX. Public table schema and props are defined in TypeScript.
- Full-column visual effects belong to a single overlay above the table, never repeated per row or cell.
- Freezing changes only sticky positioning, stacking, and the rightmost boundary. Frozen and ordinary cells share heights, row backgrounds, hover/selection styles, and horizontal separators. Header cells fit inside the header row's content box so opaque backgrounds never cover its bottom border; do not add frozen-only underlines or inset shadows.

- This app is a strict functional subset of Feishu Bitable. Every retained interaction must match the reference behavior and density rather than being simplified.
- Keep only add record, view configuration, filtering, sorting, search, saved views, column resizing/reordering, row selection, and record opening.
- Do not add AI, smart reminders, grouping, fill colors, row-height controls, inline cell editing, field-type editing, or a trailing add-row entry.
- Field types come from an external schema. View state owns field visibility, column order, column widths, filters, and sorts.
- The supported field type set is intentionally limited to text, single select, multi select, and date. Person and attachment are not field types in this component; legacy example columns using those concepts render as text.
- Double-clicking a record opens a fullscreen editor; it never edits a cell inline.
- Ship the table as an embeddable component without demo page chrome, top bars, sidebars, or workspace title rows.
- All mutations use optimistic UI: update the visible state immediately, then persist in the background.
- Match Feishu's column interactions: a pointer-driven header drag keeps the source column pale blue and moves only a translucent gray full-column mask with no text, icons, header clone, or cell clone; original headers and cells stay stationary, and a 2px blue insertion guide ends at the last data row, and commits the optimistic order only on drop; resizing shows a blue active header plus a full-height guide.
- Field configuration supports drag reordering; filter and sort choices use styled component selectors rather than native selects.
- Field visibility uses an eye/eye-off toggle; hidden fields stay in the configuration list in a muted row so they can be restored without losing order.
- The footer only shows the record count and selected count; it has no dropdown or secondary action.
- Table scrolling uses an overlay-style auto-hide scroll layer: no system rail is reserved or constantly visible, while hover/scroll reveals compact draggable thumbs.
- While the freeze handle is held, the original boundary must render exactly like ordinary column borders. Restore the real header/cell borders and suppress the dedicated freeze overlay; do not approximate those borders with a continuous colored overlay or rounded coordinates. Keep the separate blue target guide and the handle above it.
- Freeze dragging also keeps a gray full-height line and handle following the pointer continuously, independently of the blue guide snapping to the target column boundary.
- The blue freeze target guide uses the same snapping/rendering rule for every column boundary, including the original frozen boundary. Never skip the original boundary or condition target visibility on whether the frozen count changed.
- Hierarchical records are schema-driven through optional recursive `children` arrays. Parent rows expose an optimistic expand/collapse control, child rows use Feishu-like indentation and connectors, filtering/search preserves matching ancestor chains, and sorting is scoped to siblings.
- Sub-specification rows are first-class records: they participate in field views, selection, virtualization, filtering, sorting, and the same double-click fullscreen editor as parent records.
- Expanded parent rows expose Feishu-like hover actions for adding a child specification and showing the child count; adding a child opens the fullscreen editor and inserts beneath that parent optimistically.
