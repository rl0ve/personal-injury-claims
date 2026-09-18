import { useRef, useState } from "react";

interface ResizableOptions {
  /** Smallest allowed width in px. */
  min: number;
  /** Largest allowed width in px. */
  max: number;
  /**
   * Which edge the drag handle sits on relative to the panel being sized.
   * "left" = handle on the panel's right edge (drag right → wider); this is the
   * default for a left-hand panel. "right" = handle on the panel's left edge
   * (drag left → wider); use for a right-hand panel.
   */
  side?: "left" | "right";
  /** Persist the chosen width across reloads under this localStorage key. */
  storageKey?: string;
}

/**
 * Pointer-driven width for a resizable panel. Returns the current `width` and an
 * `onPointerDown` handler to wire onto a drag handle. Dragging updates the width
 * live and clamps to [min, max]; the final value is optionally saved so the
 * layout sticks between visits.
 */
export function useResizableWidth(initial: number, opts: ResizableOptions) {
  const { min, max, side = "left", storageKey } = opts;

  const [width, setWidth] = useState<number>(() => {
    if (storageKey && typeof window !== "undefined") {
      const saved = Number(window.localStorage.getItem(storageKey));
      if (Number.isFinite(saved) && saved >= min && saved <= max) return saved;
    }
    return initial;
  });

  // Tracks the live width synchronously during a drag so the pointerup handler
  // always persists the final value, independent of React's render timing.
  const latest = useRef(width);

  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault();
    const startX = e.clientX;
    const startW = latest.current;

    const onMove = (ev: PointerEvent) => {
      const delta = side === "left" ? ev.clientX - startX : startX - ev.clientX;
      const next = Math.min(max, Math.max(min, startW + delta));
      latest.current = next;
      setWidth(next);
    };
    const onUp = () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      document.body.style.removeProperty("cursor");
      document.body.style.removeProperty("user-select");
      if (storageKey) window.localStorage.setItem(storageKey, String(latest.current));
    };

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
  }

  return { width, onPointerDown };
}
