import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

// Padded, independently-scrolling container for standard pages. (Actions and the
// claim detail manage their own full-height layouts instead.)
export function PageContainer({ children, className }: { children: ReactNode; className?: string }) {
  // DS layout-grid margins: 16 / 24 / 32px across mobile / tablet / desktop.
  return (
    <div className={cn("h-full overflow-y-auto px-4 py-6 sm:px-6 lg:px-8", className)}>
      {children}
    </div>
  );
}
