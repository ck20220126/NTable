export interface ScrollbarMetrics { size: number; offset: number }

export function resizedScrollOffset(offset: number, previousViewport: number, previousContent: number, viewport: number, content: number) {
  const maximum = Math.max(0, content - viewport);
  const wasAtEnd = previousContent > previousViewport && Math.abs(previousContent - previousViewport - offset) <= 1;
  return content === previousContent && wasAtEnd ? maximum : Math.max(0, Math.min(maximum, offset));
}

export function scrollbarMetrics(viewport: number, content: number, track: number, scroll: number): ScrollbarMetrics | null {
  if (content <= viewport || viewport <= 0 || track <= 0) return null;
  const size = Math.min(track, Math.max(28, track * viewport / content));
  const progress = Math.max(0, Math.min(1, scroll / (content - viewport)));
  return { size, offset: (track - size) * progress };
}

export function scrollFromThumb(startScroll: number, delta: number, maxScroll: number, travel: number) {
  if (travel <= 0 || maxScroll <= 0) return Math.max(0, Math.min(maxScroll, startScroll));
  return Math.max(0, Math.min(maxScroll, startScroll + delta * maxScroll / travel));
}
