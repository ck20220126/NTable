import { useEffect, useRef, useState } from "react";

/** Keep typing synchronous; only the query callback is delayed. */
export function useSearchInput(search: string, onSearchChange: ((value: string) => void) | undefined, delay: number, resetKey: number) {
  const [draft, setDraft] = useState(search);
  const composing = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const callback = useRef(onSearchChange);
  callback.current = onSearchChange;
  const enabled = Boolean(onSearchChange);
  const cancel = () => { clearTimeout(timer.current); timer.current = undefined; };
  useEffect(() => {
    cancel();
    composing.current = false;
    setDraft(search);
  }, [search, resetKey, enabled]);
  useEffect(() => cancel, [delay]);
  const update = (value: string) => {
    setDraft(value);
    cancel();
    if (composing.current) return;
    if (!value) { callback.current?.(""); return; }
    timer.current = setTimeout(() => callback.current?.(value), Number.isFinite(delay) ? Math.max(0, delay) : 300);
  };
  return {
    draft,
    update,
    clear: () => { composing.current = false; cancel(); setDraft(""); callback.current?.(""); },
    startComposition: () => { composing.current = true; cancel(); },
    endComposition: (value: string) => { composing.current = false; update(value); },
  };
}
