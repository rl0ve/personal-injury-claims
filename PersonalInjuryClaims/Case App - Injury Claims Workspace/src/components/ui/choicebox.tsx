import type { ReactNode } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * CHOICEBOX — a group of option cards, each with a title, a description and its own
 * control, selected by border and tint.
 *
 * Adapted rather than pasted. Three things about the source did not belong here:
 *
 * 1. **`clsx` is not a dependency of this app** — `cn` (../../lib/utils.ts) is the
 *    same job plus tailwind-merge, and it is what every other component uses.
 * 2. **The `--ds-blue-*` / `--ds-gray-*` palette is not this app's.** Adding it would
 *    put a second source of colour beside the theme and break both dark mode and
 *    `docs/theme-rules.md`. Every value here is a semantic token — `primary`,
 *    `border`, `muted-foreground` — so the group themes with the rest of the console.
 * 3. **The control is a real input, always.** The source hides one and paints a
 *    `<span>`; keeping the input as the thing that is checked (visually hidden, not
 *    absolutely positioned) is what makes arrow keys, form association and screen
 *    readers work without a second implementation.
 *
 * Radio and checkbox both, `row` or `column`, and an optional `badge` slot beside the
 * title — which is why the resolution row can carry "Recommended" without it landing
 * on top of the option's own name.
 */

export function ChoiceboxGroup({
  name,
  type = "radio",
  value,
  onValueChange,
  direction = "row",
  ariaLabel,
  className,
  children,
}: {
  /** Shared for radios, so the browser groups them. */
  name: string;
  type?: "radio" | "checkbox";
  /** A string for `radio`, a list for `checkbox`. */
  value: string | string[];
  onValueChange: (value: string) => void;
  direction?: "row" | "column";
  ariaLabel: string;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      // A radiogroup for radios; a checkbox set is just a group.
      role={type === "radio" ? "radiogroup" : "group"}
      aria-label={ariaLabel}
      data-choicebox
      data-type={type}
      data-value={Array.isArray(value) ? value.join(",") : value}
      data-name={name}
      className={cn("flex gap-3", direction === "row" ? "flex-row items-stretch" : "flex-col", className)}
      onChange={(e) => {
        const t = e.target as HTMLInputElement;
        if (t.type === type) onValueChange(t.value);
      }}
    >
      {children}
    </div>
  );
}

export function ChoiceboxItem({
  name,
  type = "radio",
  value,
  selected,
  title,
  description,
  badge,
  disabled,
  /** Shown under the card when it is the selected one. */
  children,
}: {
  name: string;
  type?: "radio" | "checkbox";
  value: string;
  selected: boolean;
  title: ReactNode;
  description?: ReactNode;
  badge?: ReactNode;
  disabled?: boolean;
  children?: ReactNode;
}) {
  return (
    <label
      /**
       * THE SELECTED RING IS AN INLINE `boxShadow`, and it has to be.
       *
       * Every `ring-*` utility is DEAD inside `.wrc`. Measured on the running page:
       * `ring-2 ring-primary`, `ring-[3px] ring-primary`, `ring-primary/20`,
       * `ring-ring/50` and `shadow-[0_0_0_3px_var(--primary)]` all resolve to a
       * shadow list whose colours are `rgba(0,0,0,0)`, or to `none` — the console's
       * prebuilt sheet (../../../claims-console/claims-console.css) never sets
       * `--tw-ring-color`, and the shell's copy of the utility loses the cascade.
       * So `border-primary ring-[3px] ring-primary/20` drew a 1px border colour
       * change and nothing else, which is why the selection read as flat.
       *
       * An inline style cannot be outvoted by either sheet, and one dynamic value
       * is what inline style is for — the same reason ../coverage/primitives.tsx
       * writes its chevron rotation this way.
       */
      style={
        selected
          ? { boxShadow: "0 0 0 3px color-mix(in oklab, var(--primary) 18%, transparent)" }
          : undefined
      }
      className={cn(
        // `relative` IS LOAD-BEARING. The input below is `sr-only`, which is
        // `position: absolute` — with no positioned ancestor here its containing
        // block became the page wrapper eight levels up, so the control the browser
        // actually focuses sat hundreds of pixels away from the card it belongs to.
        // Clicking a card then scrolled the record to reveal a 1×1 box somewhere
        // else entirely, which is the page-shift this caused. Positioned here, the
        // input lands inside its own card and focusing it moves nothing.
        "group relative flex min-w-0 flex-1 flex-col rounded-xl border bg-card transition-[background-color,border-color,box-shadow] duration-150",
        selected ? "border-primary" : "border-border",
        disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:bg-muted/50",
      )}
    >
      {/* THE CONTROL LEADS, AND THE TEXT STACKS.
          Marker first and `items-start`, so the three cards read as a column of
          choices rather than as three rows with a dot trailing off the right edge;
          then the name (with its badge beside it) on one line and what the option
          means on the next. The description WRAPS — it used to truncate to fit one
          line, which is what "Aldergate funds the…" was. */}
      <span className="flex min-w-0 items-start gap-2.5 p-3.5">
        <input
          type={type}
          name={name}
          value={value}
          checked={selected}
          disabled={disabled}
          // `sr-only`, not `absolute` — it stays in the label so a click anywhere on
          // the card reaches it, and focus lands where the marker is drawn.
          className="peer sr-only"
          readOnly
        />
        <span
          aria-hidden
          className={cn(
            "mt-px grid size-4 shrink-0 place-items-center border-[1.5px] transition-colors duration-150",
            type === "radio" ? "rounded-full" : "rounded",
            selected ? "border-primary" : "border-border",
            selected && type === "checkbox" && "bg-primary",
          )}
        >
          {type === "radio" ? (
            <span
              className={cn(
                "size-2 rounded-full bg-primary transition-transform duration-150 ease-out",
                selected ? "scale-100" : "scale-0",
              )}
            />
          ) : (
            <Check className={cn("size-3 text-primary-foreground transition-opacity", selected ? "opacity-100" : "opacity-0")} />
          )}
        </span>

        <span className="min-w-0 flex-1">
          <span className="flex min-w-0 flex-wrap items-center gap-1.5">
            {/* 13px, not 14. The three titles sat half a pixel ABOVE the Submit
                label that files them, and there are three of them to one of it, so
                the row read louder than the action. 13 is the rung the rationale
                text and the document rows already use. */}
            <span className="text-[13px] font-semibold">{title}</span>
            {badge}
          </span>
          {description && (
            <span className="mt-0.5 block text-xs text-muted-foreground">
              {description}
            </span>
          )}
        </span>
      </span>

      {children && selected && <span className="block border-t border-border px-3.5 py-2.5">{children}</span>}
    </label>
  );
}
