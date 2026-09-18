import type { SVGProps } from "react";
import { cn } from "@/lib/utils";

/**
 * The Apollo Vertex "AI mark" (Astroid) — the design-system icon that labels
 * anything AI-driven. Fills with currentColor, so wrap it in a gradient/element
 * that sets the colour. Sizes like a lucide icon via `className` (default size-4).
 */
export function AiMark({ className, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={cn("size-4", className)}
      {...props}
    >
      <path d="M12.983 21.186a1 1 0 0 1-1.966 0 10 10 0 0 0-8.203-8.203 1 1 0 0 1 0-1.966 10 10 0 0 0 8.203-8.203 1 1 0 0 1 1.966 0 10 10 0 0 0 8.203 8.203 1 1 0 0 1 0 1.966 10 10 0 0 0-8.203 8.203" />
    </svg>
  );
}
