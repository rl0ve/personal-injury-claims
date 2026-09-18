import { ArrowUpRight, Clock, FileSearch, MessageSquare, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MENU, TYPE } from "@/components/coverage/primitives";
import { MORE_ACTIONS, type MoreActionIcon } from "@/lib/coverage/fixture";
import { cn } from "@/lib/utils";

const ICONS: Record<MoreActionIcon, typeof FileSearch> = {
  evidence: FileSearch,
  customer: MessageSquare,
  escalate: ArrowUpRight,
  defer: Clock,
};

/**
 * The four things that are not a resolution — they pause the claim or hand it on —
 * behind a plain icon button. Each carries its consequence in the row. The surface is
 * the console's own menu (../../ui/dropdown-menu.tsx), so it matches the selects.
 */
export function MoreMenu({ onPick }: { onPick: (id: string) => void }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label="Other actions"
        className="inline-grid size-9 cursor-pointer place-items-center rounded-lg text-foreground transition-all hover:bg-accent focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none data-[state=open]:bg-accent"
      >
        <MoreHorizontal className="size-4" />
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        side="top"
        sideOffset={8}
        className={cn(MENU.content, "w-[300px]")}
      >
        {MORE_ACTIONS.map((a) => {
          const Icon = ICONS[a.icon];
          return (
            <DropdownMenuItem
              key={a.id}
              onSelect={() => onPick(a.id)}
              className={cn(MENU.item, "items-start gap-3")}
            >
              <Icon className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
              <span className="min-w-0">
                <span className="block font-semibold">{a.label}</span>
                <span className={cn(TYPE.small, "block leading-snug text-muted-foreground whitespace-normal")}>{a.note}</span>
              </span>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
