import { Check, ChevronsUpDown } from "lucide-react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { ROLE_PROFILES, type Role } from "@/lib/role/RoleProvider";
import { useRole } from "@/lib/role/useRole";

/**
 * Signs the app in as one of the case's acting personas. The storyboard pins a
 * strip of them beside the product name, so this sits at the top of the sidebar
 * where the shell's company block would otherwise be.
 *
 * There is no real identity here. The persona scopes what the queue shows and
 * whose name a decision is recorded under. A UiPath sign-in, when configured,
 * runs alongside it and owns API access.
 */
export function PersonaSwitcher() {
  const { role, profile, setRole } = useRole();
  const roles = Object.keys(ROLE_PROFILES) as Role[];

  return (
    <DropdownMenu>
      {/* The trigger truncates both lines at the sidebar's width, and it is the
          one control here that does not say what it does, since an avatar and a name
          read as a label, not as a switch. The tooltip supplies both. */}
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="h-auto w-full justify-start gap-2 px-2 py-2 text-left hover:bg-sidebar-accent"
            >
              <Avatar className="size-8 shrink-0">
                <AvatarFallback className="bg-primary/10 text-xs font-semibold text-primary">
                  {profile.initials}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{profile.name}</span>
                <span className="block truncate text-xs font-normal text-muted-foreground">
                  {profile.title}
                </span>
              </span>
              <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="right">
          <span className="font-medium">
            {profile.name} · {profile.title}
          </span>
          <span className="block text-muted-foreground">Switch persona</span>
        </TooltipContent>
      </Tooltip>

      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
          Acting as
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        {roles.map((key) => {
          const candidate = ROLE_PROFILES[key];
          return (
            <DropdownMenuItem
              key={key}
              onSelect={() => setRole(key)}
              className="flex items-start gap-2 py-2"
            >
              <Avatar className="size-7 shrink-0">
                <AvatarFallback className="bg-muted text-[10px] font-semibold">
                  {candidate.initials}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{candidate.name}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {candidate.title}
                </span>
              </span>
              <Check
                className={cn("mt-1 size-4 shrink-0", role === key ? "opacity-100" : "opacity-0")}
              />
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
