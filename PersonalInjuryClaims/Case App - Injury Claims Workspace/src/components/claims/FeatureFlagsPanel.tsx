import { useState } from "react";
import { ChevronDown, FlaskConical, RotateCcw } from "lucide-react";
import { useSidebar } from "@/components/ui/sidebar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  FLAG_LABELS,
  isModified,
  resetFlags,
  setFlag,
  suppressedFlags,
  useFlags,
  type FeatureFlags,
} from "@/lib/flags";

// Presenter switches, in the sidebar footer.
//
// Collapsed by default so it does not compete with the nav, and it sits below
// the nav rather than in it because these are not places to go. They change how
// the screen you are already on behaves.

function FlagRow({
  flagKey,
  value,
  suppressed,
  onChange,
}: {
  flagKey: keyof FeatureFlags;
  value: boolean;
  /** Why this flag currently does nothing, when something else overrides it. */
  suppressed?: string;
  onChange: (next: boolean) => void;
}) {
  const { label, hint } = FLAG_LABELS[flagKey];
  // Still switchable while suppressed, because a presenter setting the room up should
  // be able to arrange both halves of a pair in either order. Dimmed, though, and
  // saying what is overriding it instead of what it would do.
  return (
    <label
      className={cn(
        "flex cursor-pointer items-start gap-2 rounded-md px-1.5 py-1.5 transition-colors hover:bg-sidebar-accent",
        suppressed && "opacity-55",
      )}
      title={suppressed ?? hint}
    >
      {/* A switch rather than a checkbox: these are on/off states of the running
          demo, not items being selected. */}
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        onClick={() => onChange(!value)}
        className={cn(
          "mt-0.5 inline-flex h-4 w-7 shrink-0 items-center rounded-full p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50",
          value && !suppressed ? "bg-primary" : "bg-muted-foreground/30",
        )}
      >
        <span
          className={cn(
            "size-3 rounded-full bg-white shadow-sm transition-transform",
            value && "translate-x-3",
          )}
        />
      </button>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-medium leading-tight">{label}</span>
        <span className="block text-[10.5px] leading-snug text-muted-foreground">
          {suppressed ?? hint}
        </span>
      </span>
    </label>
  );
}

export function FeatureFlagsPanel() {
  const flags = useFlags();
  // Read collapse state from the sidebar rather than taking it as a prop, because the
  // footer slot renders children directly, so there is nothing to pass it down.
  const { state, isMobile } = useSidebar();
  const [open, setOpen] = useState(false);
  const modified = isModified(flags);
  const suppressed = suppressedFlags(flags);

  // The collapsed rail has no room for labels, and the icon alone would be a
  // mystery, so the section hides until the sidebar is expanded.
  if (state === "collapsed" && !isMobile) return null;

  return (
    <div className="flex flex-col border-t border-sidebar-border pt-2">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="flex items-center gap-2 rounded-md px-1.5 py-1.5 text-left transition-colors hover:bg-sidebar-accent"
          >
            <FlaskConical className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="text-xs font-medium">Feature flags</span>
            {modified && <span className="size-1.5 rounded-full bg-primary" />}
            <ChevronDown
              className={cn(
                "ml-auto size-3.5 shrink-0 text-muted-foreground transition-transform",
                !open && "-rotate-90",
              )}
            />
          </button>
        </TooltipTrigger>
        {/* "Feature flags" names the section without saying what it is for, and
            the dot beside it is unexplained until you hover it. Both belong in
            one tooltip on the row rather than a title on the dot alone. */}
        <TooltipContent side="right" className="max-w-64">
          <span className="font-medium">Presenter switches</span>
          <span className="block text-muted-foreground">
            {modified
              ? "Some differ from the shipped defaults. Open to review or reset them."
              : "Turn parts of the demo on and off. All at their shipped defaults."}
          </span>
        </TooltipContent>
      </Tooltip>

      {open && (
        <div className="flex flex-col gap-0.5 pb-1">
          {(Object.keys(FLAG_LABELS) as (keyof FeatureFlags)[]).map((key) => (
            <FlagRow
              key={key}
              flagKey={key}
              value={flags[key]}
              suppressed={suppressed[key]}
              onChange={(next) => setFlag(key, next)}
            />
          ))}
          {modified && (
            <button
              type="button"
              onClick={resetFlags}
              className="mt-1 flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-foreground"
            >
              <RotateCcw className="size-3" />
              Reset to defaults
            </button>
          )}
        </div>
      )}
    </div>
  );
}
