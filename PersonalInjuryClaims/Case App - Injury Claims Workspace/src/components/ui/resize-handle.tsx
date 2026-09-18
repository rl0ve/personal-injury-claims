import { cn } from "@/lib/utils";

/**
 * A thin vertical divider that a user can drag to resize the panel beside it.
 * Renders a 1px seam by default and thickens into a primary-tinted grip on
 * hover / while dragging. Wire `onPointerDown` to a `useResizableWidth` handle.
 */
export function ResizeHandle({
  onPointerDown,
  className,
  "aria-label": ariaLabel = "Resize panel",
}: {
  onPointerDown: (e: React.PointerEvent) => void;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      className={cn(
        "group relative z-10 w-1 shrink-0 cursor-col-resize touch-none select-none self-stretch",
        className,
      )}
    >
      {/* Resting seam. Deliberately stronger than a plain border: it divides two
          panes that both carry cards, and at `bg-border` the queue and the
          decision read as one surface with a hairline through it. */}
      <span className="absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-foreground/15 transition-colors group-hover:bg-primary/40" />
      {/* Wider grip that appears on hover / drag */}
      <span className="absolute inset-y-0 left-1/2 w-1 -translate-x-1/2 rounded-full bg-primary/0 transition-colors group-hover:bg-primary/40 group-active:bg-primary" />
    </div>
  );
}
