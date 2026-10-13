# NTable component and demo instructions

Run the local server yourself and open the preview in the browser available to this environment. Do not give the user server-start instructions when you can run it.

Before making substantial visual changes, use the Product Design plugin's `get-context` skill when the visual source is unclear or no longer matches the current goal. When the user gives durable prototype-specific design feedback, preferences, or decisions, record them in `AGENTS.md`.

When implementing from a selected generated mock, treat that image as the source of truth for layout, component anatomy, density, spacing, color, typography, visible content, and hierarchy.

Build app UI in `src/`. Keep `.openai/hosting.json`, `worker/index.js`, `scripts/prepare-sites-build.mjs`, and `tests/sites-worker.test.mjs` intact so the same local demo can be handed to Sites. Before a Sites handoff, run `npm run build` and `npm run test:sites`; the build must leave `dist/client/index.html`, `dist/server/index.js`, and `dist/.openai/hosting.json`.

## Product decisions

- Column menus offer freeze-to-field but no cancel-freezing action. Freeze-range adjustment remains available through the boundary handle.

- Freeze-boundary dragging snaps to the visible column edges after horizontal scrolling. Frozen fields use viewport coordinates; ordinary fields subtract the current scroll offset. Skip ordinary fields occluded by the frozen prefix, preserve the original boundary on press, and use the visible portion of a partially clipped field for its midpoint. On release, transition the same guide to the committed frozen-prefix boundary.

- Local delivery bundles live under generated `dist/release/<version>-<candidate>/`, with the actual tarball at the root, integration documents in `docs/`, read-only contract references in `contract/`, and selected current acceptance evidence in `qa/`. A bundle includes an index and SHA256 manifest, excludes dependencies/secrets/demo/CI, and is labelled candidate until remaining delivery gates are resolved. Never overwrite or remove an existing candidate directory; produce a separately named archive when needed.

- Clicking a column header selects it without moving the view when the column is already fully visible; a column clipped by an edge gets the smallest scroll that reveals it. Frozen columns skip the reveal entirely: `scrollIntoView` works from the element's layout position, and a sticky column's layout position has long since scrolled off to the left, so asking for it scrolls the view backwards.

- Column selection tints the cells themselves; there is no column-wide overlay. An overlay cannot be occluded by the frozen prefix alone: rows are absolutely positioned with `contain: layout paint` and an opaque background, so raising the overlay paints it over every frozen element (an ordinary column scrolled behind the frozen prefix leaves a band floating on the frozen columns) and lowering it hides it behind the rows. Tinting per cell lets the frozen cells, opaque and higher in the row's own stacking context, occlude ordinary cells that slide under them, and a selected frozen column tints the sticky cells themselves, so nothing has to be re-derived from scrollLeft and nothing drifts. Keep the ordinary tint translucent so the row's own background still shows through, and keep the frozen variant opaque or scrolled content shows through it.

- Freezing is stored as a column count, not as field identities, so any reorder must keep the frozen field set intact. `frozenCountAfterMove` adjusts the count whenever a moved column crosses the freeze boundary; without it, dragging a frozen column out promotes whichever column slides into its slot.

- Empty cells render as empty. Select-type fields with no matching option, and multi-select fields without an array value, render nothing rather than a dash placeholder; the column stays visually blank so real values and absent ones are distinguishable at a glance.

- Filter panels whose content width is below 400px use two lines per condition: field and remove control first, operator and value second. Preserve 150px field and 84px operator widths, natural keyboard order, and usable value-input space. Empty operators retain the same remove-control position; ordinary panels keep their single-line geometry.

- A resize commit merges only its field width into the latest committed host width map, preserving concurrent hidden-column settings. A hidden-only width update does not cancel the visible gesture or change its live preview.

- A host change to the active view, visible column geometry, committed widths, frozen count or viewport width invalidates any ongoing column/freeze/resize gesture before paint. Compare semantic geometry so equivalent host objects do not cancel a gesture or reset its live resize preview. Cancellation restores the latest host widths and never emits a stale update callback.

- On devices whose primary pointer is coarse and has no hover, show the existing freeze handle at the committed boundary below the header without requiring hover. Keep its text hint transient, constrain touch suppression to the handle, and restore its committed position after release/cancellation. Mouse devices retain hover positioning and visibility.

- Column reorder, column resize and freeze-boundary gestures start only from a primary pointer. A secondary contact must not replace the initiating gesture; pointer cancellation and lost capture apply only to its initiating pointer ID. Escape, blur and host cleanup still cancel the gesture independently of pointer identity.

- Opening the filter popover focuses its dialog without scrolling, so Tab enters its controls instead of dismissing it. Do not automatically focus the info tooltip. Dialog names append 配置 only when the trigger label does not already include that suffix.

- Column dragging uses the actual rendered header edge for its grab offset. Hit testing treats the sticky frozen prefix in viewport coordinates and ordinary columns in scrolled content coordinates; insertion guides use the same visual boundary and cannot target a scrolled-away column behind the frozen prefix.
- The source-column drag highlight follows the rendered sticky position for frozen fields, including horizontal scrolling; the ordinary source highlight retains its content position and is clipped at the frozen boundary so it never tints unrelated sticky fields.
- Retain the pressed source column before the drag threshold is reached, so horizontal windowing cannot remove its capture target. Removing that source from the host schema cancels the gesture before another move; completion/cancellation releases the retained column.
- Consumer gesture diagnostics are passive and bounded. Record capture events and painted geometry without changing pointer input or production state; distinguish geometry observations from actual visual rendering and native gestures from simulated cancellation.

- Open column menus are invalidated when their saved field/index no longer identifies the current rendered schema and order. Close before paint so menu actions cannot mutate a different column; restore grid focus only when the invalidated menu owned it, preserving outside focus.

- If a focused configuration control is removed while its toolbar popover stays open, return focus to that popover without scrolling. Ordinary blur outside the popover clears the recovery candidate; schema/view updates must not steal focus from another control. Hosts still clean invalid field references when schema changes.

- Selector option buttons expose the current committed choice with `aria-current="true"`, matching the visual check. Keep ordinary button activation and existing arrow navigation; filtered-out or unset values do not mark an unrelated fallback option as current.

- Explicitly closing record search restores focus to the remounted search trigger without scrolling the host page. Initial mounting and external callback removal must not steal focus; clearing search still cancels pending query work immediately.

- Focused column-width commits reveal the active cell again, including keyboard resizing at the last column. Do not auto-reveal while a pointer resize gesture is active; reveal after completion or cancellation using committed geometry.

- The last logical column resize hit area stays inside the table extent. Mounting the last virtual column must not add phantom horizontal scroll space; intermediate handles retain their boundary-centered hit area and all resize guides use the real header edge.

- Pointer-drag acceptance requires an observed capture lifecycle plus scroll displacement; a trusted pointerdown or an immediate hasPointerCapture snapshot alone is insufficient. Distinguish protocol input from native app input and keep failed transport observations separate from product defects.

- Scrollbar hover changes visibility and its hide timer, never reconnects scroll listeners/ResizeObservers or resets resize anchoring. Keep one observation lifetime per mounted viewport; callbacks read current hover state and unmount cleans observers, listeners and timers.

- Column widths, prefix offsets, total width and grid template share one linear geometry calculation, cached until ordered fields or live widths change. Scroll-only updates must not repeat quadratic prefix slicing; resizing, reordering, freezing and end insertion retain the same 42px gutter geometry.

- The all-record checkbox visibly distinguishes unchecked, mixed and checked: mixed uses the selected control fill with a horizontal minus, checked uses a check. Preserve aria-checked mixed and toggle-visible-records semantics; forced-colors keeps a visible system-colored indicator.
- Demo and library source checks both require TypeScript strict mode and dependency declaration checking (`skipLibCheck: false`). Missing demo mount roots fail explicitly before createRoot; do not use non-null assertions or type suppressions to conceal an invalid startup document.
- Each cell retains an independent Radix Tooltip Provider. A shared Provider candidate blocked the next value while the pointer stayed in the previous long tooltip hover corridor; do not reuse that candidate without proving value-to-value handoff and hoverable content together.
- Fixed 32px records use four rows of overscan per side; retain the active record separately. Keep complete viewport coverage and synchronous scroll updates. Validate buffer changes with both axes, large jumps and last-record/last-column navigation; fewer mounted rows alone is not proof of smooth scrolling.
- Virtual record rows use controlled native checkboxes for boolean selection, without per-row form proxies or size observers. Preserve the 15px visual control, one grid Tab entry, pointer selection, Space selection, Enter suppression and double-click boundary. The all-record header retains its three-state Radix checkbox. Selection inputs have no name and do not become business form values; forced-colors mode retains a native check indicator.
- Cell tree metadata reuses the current stable DisplayRow; expansion/divider state stays explicit, and toggles use a stable row-ID callback. Never ignore changing cell props in a custom memo comparator to gain reuse.
- Frozen-cell geometry props remain stable until schema/order/width/freeze changes; viewport-only scrolling must not rebuild equivalent style objects for every mounted row.
- Native horizontal scroll commits a changed column viewport synchronously before paint so fast jumps cannot expose an old column window. Skip unchanged offsets/sizes and never flush from React effects; initial measurement stays a normal layout-effect update.
- Wide tables window offscreen columns as well as rows. Keep full column geometry, logical aria indices, frozen columns, the active column, and columns in a gesture/menu mounted. Use explicit CSS grid positions so gaps do not shift cells; query/filter/sort still operate on every visible schema field.
- Configuration panels and shared selector/popover contracts have a strict TypeScript gate. Use generic string option values so filter operators and match modes remain their declared unions; type drag-end callbacks from provider props. Narrow missing schema lookups explicitly rather than suppressing errors or widening to any. All library sources now run with strict enabled through typecheck:lib and build:lib. Main table state, gestures and cells require explicit types. The old panel-only configuration is retained as a focused check; verify uses the whole-library gate.
- Empty-state content keeps its natural size inside a scrollable overlay. Center only when it fits using auto margins on a nonshrinking content group; overflow starts at the top, and icons/actions never shrink or escape the scroll origin. Normal and compact hosts share the same status semantics.
- View names retain their full source string and accessible name. Bound their text area to 12em with CSS ellipsis and use the shared Tooltip for the complete name; icons/menu controls must not shrink or be pushed outside the tab viewport.
- Controlled active-view changes reveal the active tab and its menu within the view-tab scroller without stealing focus. Focused controls reveal themselves locally; resizing repeats the check, and successful deletion restores focus and visibility together.
- View tabs constrain their own horizontal overflow so their intrinsic width cannot widen the table grid track.
- Narrow toolbars keep search input and close control inside their own width. Scroll the action group independently with nonshrinking buttons; never expand or horizontally scroll the entire table layout to reach toolbar controls. Keyboard focus must reveal each action inside the group.
- Narrow hosts reduce rendered freezing until the first ordinary field fits beside the frozen prefix. Preserve saved frozenFieldCount, never persist responsive changes, and restore the prefix when space returns. Unknown initial width preserves requested freezing; configured and rendered counts remain separate for menu/pending-commit semantics.
- Focused width changes reveal ordinary active columns past the actual frozen-cell boundary. Preserve logical focus and column identity; if the remaining space is narrower than the cell, expose its leading edge without oscillating between both edges.
- Focused layout resizing must reveal intermediate active records inside the virtual viewport, respecting the 36px sticky header, before adjusting outer layout scrollers. Edge anchoring alone is insufficient; keep activity identity and focus stable.
- Keyboard navigation reveals the active cell within component-owned `.ntable-table` and `.ntable` layout scrollers as well as the inner virtual viewport. Focused grids repeat this check on their own layout resizing; do not scroll arbitrary host-page ancestors.
- Small hosts never collapse the record viewport to zero: reserve at least 68px for header plus one 32px row. NTable scrolls its own layout when its bars and minimum record area exceed the assigned height; standalone Table also contains its layout overflow. Keep normal-size virtual scrolling and host body styling unchanged.
- When only the scroll viewport size changes, retain an existing bottom/right edge position (within 1px), so status banners do not hide the visible last row. Preserve intermediate offsets, clamp to valid bounds, and do not anchor when the data extent changes.
- Tree projection, record identity collection, and initial expansion collection use iterative traversal so valid deep trees do not exhaust the JavaScript call stack. Preserve sibling order, retained ancestor paths, subtree matching, and child-count semantics. Store only ancestor levels that actually draw continuation lines; collapsed deep chains must not allocate quadratic connector metadata.
- Number fields sort by finite numeric value, including negatives and decimals; empty/invalid values follow valid numbers in both directions. Other fields retain Chinese natural text ordering. Sorting stays stable and scoped to siblings. Tree query projection visits each record once, preserving complete subtrees when an ancestor matches.
- Enter while composing a view name never creates a view. Filter value and field-search inputs have accessible labels. In field-selector menus, Down from the search input focuses the first result and Up focuses the last; composition keystrokes remain owned by the input method.

- Each view may set `deletable: false` to hide its delete menu and prevent delete callbacks. Omission preserves existing behavior; the last remaining view cannot be deleted. Hosts own deletion authorization and persistence.
- View buttons expose their selected state. After a requested view deletion is reflected by the host, focus returns to the host-selected current view; a rejected deletion retains the existing menu-trigger focus behavior.
- Record search matches raw values and displayed option labels for singleSelect/multiSelect, case-insensitively. Only visible searchable fields participate. Keep raw-value compatibility, ancestor/subtree rules, and raw-value filter/sort semantics; do not add label matches for hidden or non-searchable fields. Build option-label lookup once per query projection, not per record.
- Search uses a controlled `onChange` draft with a 300ms default debounce (configurable by the host). IME composition updates the visible draft but never searches until composition ends; closing/clearing cancels pending work and clears immediately. Unmount and external resets cancel stale searches.
- Removing the search callback cancels pending queries and discards the uncommitted draft. Restoring the callback must not revive an earlier pending query.
- Keyboard browsing has one grid Tab entry and a stable active cell across virtualization. Arrow keys, Home/End, Ctrl/Meta+Home/End, PageUp/PageDown navigate; Space selects, Shift+Up/Down extends row selection, Ctrl/Meta+A selects displayed records, Escape clears selection, and Enter opens a record. On the first data column Left/Right collapse/expand tree rows (queries keep matching paths expanded). Headers are keyboard reachable: Enter opens the column menu, Alt+Left/Right reorders, Shift+Left/Right resizes. Inputs and open menus own their own keys.
- Hosts may pass `loading`, `error` (user-facing text), and `onRetry`. Empty data distinguishes initial loading, failed load, an empty dataset, and no query matches. With existing rows, loading/error is a nonblocking status above the grid and rows/selection/scroll remain available. Hosts retain rows during refresh and own requests, cancellation, error sanitization, and retry completion. Loading takes precedence over an earlier error and disables retry. No network client is added to the library.

- Export ViewBar, TableToolbar, and Table from separate TSX files; NTable only composes these three. Toolbar panels have their own files. Keep table headers and cells within Table rather than fragmenting every table element.

- React components use TSX. Public table schema and props are defined in TypeScript.
- Full-column visual effects belong to a single overlay above the table, never repeated per row or cell.
- Freezing changes only sticky positioning, stacking, and the rightmost boundary. Frozen and ordinary cells share heights, row backgrounds, hover/selection styles, and horizontal separators. Header cells fit inside the header row's content box so opaque backgrounds never cover its bottom border; do not add frozen-only underlines or inset shadows.

- This app is a strict functional subset of Feishu Bitable. Every retained interaction must match the reference behavior and density rather than being simplified.
- Keep only add record, view configuration, filtering, sorting, search, saved views, column resizing/reordering, row selection, and record opening.
- Do not add AI, smart reminders, grouping, fill colors, row-height controls, inline cell editing, field-type editing, or a trailing add-row entry.
- Field types come from an external schema. View state owns field visibility, column order, column widths, filters, and sorts.
- The supported field type set is intentionally limited to text, number, single select, multi select, and date. Person and attachment are not field types in this component; legacy example columns using those concepts render as text.
- Double-clicking a record opens a fullscreen editor; it never edits a cell inline.
- Double-clicking a row checkbox only changes selection and never opens the record; tree controls also retain their own double-click boundary.
- Column menus stay inside the viewport with an 8px inset. In short viewports they scroll internally so every action remains reachable; long field labels do not widen the menu beyond the screen.
- Toolbar configuration popovers keep an 8px viewport inset, constrain their width/height to the available space, and scroll internally when long condition lists exceed it. Nested selectors remain portaled and keyboard accessible.
- Toolbar popover width is bounded by both the CSS viewport and Radix's available width; `100vw` alone includes a reserved system scrollbar and may overflow the visual viewport. Keep ordinary panel widths and internal scrolling unchanged.
- Close an open toolbar configuration panel when its trigger becomes fully invisible through viewport or local clipping changes. Preserve already submitted edits; suppress automatic focus restoration only for this visibility dismissal so it cannot scroll the host page to an offscreen trigger. Normal Escape/outside dismissal retains Radix focus behavior.
- Searchable selectors clear their local query on every open/close path, including keyboard opening and choosing a result. Closed popovers stop entry animations immediately so hidden controls cannot remain visible while waiting for an animation event.
- Library declarations must resolve with both Bundler and NodeNext module resolution, with library checking enabled; emitted relative module specifiers include their ESM `.js` extension.
- Ship the table as an embeddable component without demo page chrome, top bars, sidebars, or workspace title rows.
- All mutations use optimistic UI: update the visible state immediately, then persist in the background.
- Match Feishu's column interactions: a pointer-driven header drag keeps the source column pale blue and moves only a translucent gray full-column mask with no text, icons, header clone, or cell clone; original headers and cells stay stationary, and a 2px blue insertion guide ends at the last data row, and commits the optimistic order only on drop; resizing shows a blue active header plus a full-height guide.
- Field configuration supports drag reordering; filter and sort choices use styled component selectors rather than native selects.
- Field configuration has a dedicated, keyboard-focusable drag handle. Visibility buttons own Enter/Space and never initiate dragging; the last valid visible field has a disabled hide button. Rows without a selection callback are not exposed as inert buttons.
- Field visibility uses an eye/eye-off toggle; hidden fields stay in the configuration list in a muted row so they can be restored without losing order.
- The footer only shows the record count and selected count; it has no dropdown or secondary action.
- View menu buttons are 20px square around their 16px icon (2px space per side).
- View tabs are 32px tall. The toolbar row is 36px tall, reducing its vertical space by 3px on each side while keeping the actions vertically centered.
- Hierarchy toggles use a centered 18px square hover background inside a 22px square hit target, without shifting the arrow, guide, or text.
- Table scrolling uses an overlay-style auto-hide scroll layer: no system rail is reserved or constantly visible, while hover/scroll reveals compact draggable thumbs.
- Overlay scrollbar thumbs never exceed their tracks, including short hosts. Only the initiating primary pointer drives a drag; Escape, blur, lost capture, resize and unmount cancel it. The rail stays visible until the drag ends even when the pointer leaves the table.
- While dragging a column, resize handle, freeze handle or scrollbar, Escape only cancels that gesture and does not clear the grid selection.
- Both overlay scrollbar rails sit 2px from their exposed table edges. When both rails appear, each stops at the other's near edge without overlapping in the bottom-right corner; thumb travel uses the actual rail length.
- While the freeze handle is held, the original boundary must render exactly like ordinary column borders. Restore the real header/cell borders and move the single freeze boundary overlay to the blue snapped target; do not draw a second overlay at the original boundary or approximate those borders with a continuous colored overlay.
- Freeze dragging also keeps a gray full-height line and handle following the pointer continuously, independently of the blue guide snapping to the target column boundary.
- The blue freeze target guide uses the same snapping/rendering rule for every column boundary, including the original frozen boundary. Never skip the original boundary or condition target visibility on whether the frozen count changed.
- On freeze-handle release, keep that same boundary overlay at the target until the new frozen boundary is committed. The old boundary line must not reappear or leave a blank transition frame.
- The freeze handle and every boundary line share the column-boundary center. On release, the boundary overlay changes to its committed width and color in place; it must not switch between separate rendered lines.
- Hierarchical records are schema-driven through optional recursive `children` arrays. Parent rows expose an optimistic expand/collapse control, child rows use Feishu-like indentation and connectors, filtering/search preserves matching ancestor chains, and sorting is scoped to siblings.
- Hierarchy styling follows the live Feishu reference: 22px indentation per level, text 20px after the toggle center, and a 2px-wide #eeeff1 guide with 2px dashes and 2px gaps. Guides align with the ancestor toggles, begin below expanded toggles, and end at the last sibling's center. Within a subtree, row dividers begin 12px to the right of the next row's parent guide; the row-number gutter has no vertical divider. Ancestor guides continue correctly through nested descendants.
- Sub-specification rows are first-class records: they participate in field views, selection, virtualization, filtering, sorting, and the same double-click fullscreen editor as parent records.
- Child creation belongs to the business record detail page. Do not render inline add-child or open-record buttons; rows open through double-click. Preserve expand/collapse and the child count.

- Filters offer contains, not contains, equals, and not equals for non-number fields. Number fields offer equals, not equals, greater than, and less than. All fields offer is empty and is not empty; these operators hide the value input, clear its value, and remain active without a value. Empty means null, undefined, an empty string, or an empty array; zero is not empty. Switching fields resets unsupported operators to the first supported operator. Empty or invalid numeric values never compare as zero.

- The demo includes a number field named 数量 after 关注部门, with numeric zero and empty examples for filter verification. Existing saved views gain the field once without resetting their other settings.
- Table typography uses the Feishu-like system font stack: 14px regular for headers, cells (including tree rows), tags, view tabs, toolbar labels, and panel controls; 12px for row numbers and footer metadata. Text line height is 20px while data rows remain 32px and view/toolbar heights remain unchanged.
- Filter condition rows have 2px padding and no row hover background. Their remove button stays in the rightmost grid column even when the value input is hidden.
- Condition remove buttons use a subtle danger-tinted background on hover, paired with the danger icon color.

- All filter value inputs use the placeholder 请输入.
- Select trigger and option labels retain the complete source string. Limit their text area to 8em (including the ellipsis) and use CSS text-overflow ellipsis, never character slicing. Hover tooltips show the full label above triggers and to the right of options.

- Filter operator selectors use an 84px trigger and a 94px minimum menu width, sized for actual three-character text metrics and their icons. Operator labels must never shrink or ellipsize.
- Filter operator triggers size to their content; both the left text inset and the text-to-chevron gap are 8px, with 8px right padding. Do not distribute extra width between the label and chevron.
- The filter title has an info icon with the hover text 此次筛选仅对自己生效。. With more than one draft condition, show 符合以下 [所有/任意] 条件; default to all, persist filterMode in view state, and apply AND/OR to active conditions. No active conditions means no filtering in either mode.

- Feishu filter fidelity: the conjunction selector is a 22px borderless inline control (4px horizontal padding, 4px content gap, 12px chevron), gray only on hover/open. Its menu has compact 30px options, blue selected text/check, and a neutral hover background. Filter panel uses 16px inset, 14px/500 title and 32px controls. Keep explicitly requested custom copy, 2px row padding, danger delete hover, and no AI features. Arrow keys navigate choices; Enter selects; Escape closes the inner menu before the panel.
- Use the shared Radix Tooltip wrapper for all select-label and filter-info tooltips. Radix owns hover/focus timing, dismissal, portal positioning and viewport collision handling; do not hand-position tooltip coordinates or use CSS-only visibility.
- View labels may defer focus opening by two animation frames so their initial local reveal scroll finishes before Radix opens the tooltip. This opt-in must cancel on blur, pointer activation, Escape, Enter, Space and unmount; subsequent scrolling still dismisses through Radix. Default tooltips retain Radix timing.

- Filter row controls keep fixed widths: field label area is 8em (150px total trigger at 14px text), and operator trigger is 84px. Short labels must not shrink these controls or shift the value inputs between rows.

- Sorting field triggers and options use their full available text width with CSS ellipsis only on overflow; the filter-specific 8em text cap does not apply to sorting.
- Sort rows have 2px padding and no row hover background. Drag handles reorder priority through dnd-kit; controls never initiate row dragging. Add rules through a searchable “选择条件” field selector, excluding fields already used. Sort direction uses two adjacent segments on a gray track, with a white active segment and blue text. All field types use the visible labels 顺序 / 倒序. The add-field selector is 32px high, fit-content, with 12px horizontal padding and muted placeholder text.

- Sort direction segments use Radix Radio Group for selection, keyboard navigation, and focus management. Do not implement radio semantics or keyboard navigation by hand.

- The add-record plus icon is offset down by 2px. Sort rows use flex layout: fixed drag handle and direction segments, a flexible field selector, and the remove button at the right edge in normal flow.

- Sort rows occupy 100% of the list width with border-box sizing and 2px padding on every side. The trailing remove control is a fixed 24px square and ends 2px before the row edge.

- Data cell text uses the shared Radix Tooltip to show its complete displayed value on hover. Select fields show option labels; empty values have no tooltip. Preserve truncation and hierarchy controls.
