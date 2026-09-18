import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";

/**
 * Uniform header for the case Overview widgets: an icon + title on the left and
 * any view controls (button group / toggle) top-right. When `onOpen` is set the
 * title becomes a ghost button that jumps to the related tab, so every widget
 * says where its full version lives.
 */
export function WidgetHeader({
  icon,
  title,
  onOpen,
  children,
}: {
  icon: ReactNode;
  title: string;
  onOpen?: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2">
      {onOpen ? (
        <Button
          variant="ghost"
          size="sm"
          onClick={onOpen}
          aria-label={`Open ${title}`}
          className="-ml-2 h-auto gap-2 px-2 py-1 text-base font-semibold"
        >
          {icon}
          {title}
        </Button>
      ) : (
        <span className="flex items-center gap-2 text-base font-semibold">
          {icon}
          {title}
        </span>
      )}
      {children}
    </div>
  );
}
