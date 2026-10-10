/** Logical field indices to mount; the selection column occupies the first 42px. */
export function windowedColumns(widths: number[], scrollLeft: number, viewportWidth: number, frozenCount: number, retained: number[] = []) {
  if (viewportWidth <= 0) return widths.map((_, index) => index);
  const frozenWidth = 42 + widths.slice(0, frozenCount).reduce((sum, width) => sum + width, 0);
  const left = Math.max(frozenWidth, scrollLeft + frozenWidth - 160);
  const right = scrollLeft + viewportWidth + 160;
  const indices = new Set(retained.filter(index => index >= 0 && index < widths.length));
  let start = 42;
  widths.forEach((width, index) => {
    if (index < frozenCount || (start + width > left && start < right)) indices.add(index);
    start += width;
  });
  return [...indices].sort((a,b) => a-b);
}

/** Fit the frozen prefix plus its first ordinary field without changing the saved view. */
export function fittingFrozenCount(widths: number[], requestedCount: number, viewportWidth: number) {
  let count = Math.max(0, Math.min(requestedCount, widths.length - 1));
  if (viewportWidth <= 0) return count;
  let boundary = 42 + widths.slice(0, count).reduce((sum, width) => sum + width, 0);
  while (count > 0 && boundary + widths[count] > viewportWidth) boundary -= widths[--count];
  return count;
}

/** Field starts and the final insertion boundary, including the selection gutter. */
export function columnGeometry(widths: number[]) {
  const offsets = [42];
  let totalWidth = 42;
  const tracks: string[] = ["42px"];
  for (const width of widths) {
    totalWidth += width;
    offsets.push(totalWidth);
    tracks.push(`${width}px`);
  }
  return { offsets, totalWidth, gridTemplate: tracks.join(" ") };
}

/** Insertion slot in the visible frozen/scrolling regions; left is a content coordinate. */
export function columnDropTarget(offsets: number[], frozenCount: number, scrollLeft: number, viewportX: number) {
  const count = offsets.length - 1;
  const frozenEdge = offsets[frozenCount];
  const inFrozen = frozenCount > 0 && viewportX < frozenEdge;
  const point = inFrozen ? viewportX : viewportX + scrollLeft;
  const start = inFrozen ? 0 : frozenCount;
  const end = inFrozen ? frozenCount : count;
  let slot = end;
  for (let index = start; index < end; index++) {
    if (point < (offsets[index] + offsets[index + 1]) / 2) { slot = index; break; }
  }
  const left = frozenCount > 0
    ? slot <= frozenCount ? offsets[slot] + scrollLeft : Math.max(offsets[slot], frozenEdge + scrollLeft)
    : offsets[slot];
  return { slot, left };
}
