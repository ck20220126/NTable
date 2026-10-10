/** Passive, bounded observation of a single header gesture in the consumer fixture. */
export function traceColumnDrag(root: HTMLElement) {
  const events: { type: string; trusted: boolean; x: number; captured: boolean }[] = [];
  const frames: { x: number; maskLeft: number; anchorError: number; guideLeft: number | null }[] = [];
  let pointerId: number | null = null;
  let x = 0, grabOffset = 0, frame = 0, stopped = false;
  const grid = root.querySelector<HTMLElement>('.grid-scroll');
  if (!grid) throw new Error('Missing consumer grid');
  const sample = () => {
    if (stopped) return;
    const mask = grid.querySelector('.column-drag-mask');
    const guide = grid.querySelector('.column-drop-indicator');
    if (mask && frames.length < 120) {
      const maskLeft = mask.getBoundingClientRect().left;
      frames.push({ x, maskLeft, anchorError: maskLeft - (x - grabOffset), guideLeft: guide?.getBoundingClientRect().left ?? null });
    }
    if (pointerId !== null && frames.length < 120) frame = requestAnimationFrame(sample);
  };
  const types = ['pointerdown', 'pointermove', 'pointerup', 'pointercancel', 'gotpointercapture', 'lostpointercapture'];
  const listener = (event: Event) => {
    if (!(event instanceof PointerEvent) || stopped) return;
    if (pointerId === null) {
      const header = event.target instanceof Element ? event.target.closest<HTMLElement>('.grid-head-cell') : null;
      if (event.type !== 'pointerdown' || !header || !root.contains(header)) return;
      pointerId = event.pointerId;
      grabOffset = event.clientX - header.getBoundingClientRect().left;
      frame = requestAnimationFrame(sample);
    }
    if (event.pointerId !== pointerId) return;
    if (event.type === 'pointerdown' || event.type === 'pointermove' || event.type === 'pointerup') x = event.clientX;
    if (events.length < 128) events.push({ type: event.type, trusted: event.isTrusted, x, captured: event.target instanceof Element && event.target.hasPointerCapture(event.pointerId) });
  };
  types.forEach(type => window.addEventListener(type, listener, { capture: true, passive: true }));
  const stop = () => {
    stopped = true;
    clearTimeout(timer);
    cancelAnimationFrame(frame);
    types.forEach(type => window.removeEventListener(type, listener, true));
    return { summary: { frames: frames.length, capture: events.some(event => event.type === 'gotpointercapture'), release: events.some(event => event.type === 'lostpointercapture'), maxAnchorError: frames.length ? Math.max(...frames.map(item => Math.abs(item.anchorError))) : null, guides: frames.filter(item => item.guideLeft !== null).length, layerRemaining: !!grid.querySelector('.column-drag-layer') }, events, frames };
  };
  const timer = window.setTimeout(stop, 20000);
  return stop;
}
