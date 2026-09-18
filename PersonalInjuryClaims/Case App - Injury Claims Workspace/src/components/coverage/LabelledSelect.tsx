import type { ReactNode } from "react";
import { Check, ChevronDown } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { MENU, TYPE } from "@/components/coverage/primitives";
import { cn } from "@/lib/utils";
import type { EvidenceCall, Importance } from "@/lib/coverage/fixture";

/**
 * A captioned select whose trigger shows the value's own icon.
 *
 * IT FITS ITS OWN VALUE, and the reflow that costs is absorbed by where it sits.
 *
 * This is a reversal. It used to hold the width of its longest label so nothing
 * moved on a change — which was right about the reflow and wrong about the result:
 * on `Approve` inside a box sized for `Partially approve` the chevron sat about
 * 90px from the word, and a left-aligned label with a right-pinned chevron reads as
 * a half-empty form field rather than a value. The dead space cost more than the
 * movement did.
 *
 * What makes fitting safe is the ROW, not this component: the two controls sit in a
 * right-anchored cluster (`ml-auto` in ../EvidenceList.tsx), so one that grows grows
 * LEFTWARD into the row's empty middle. Every row's right edge stays put and nothing
 * after it moves. Left-align that cluster and this decision becomes wrong again.
 *
 * **Stable is now MEASURED rather than declared.** It used to be a `width` prop the
 * call site typed — 96px for importance in a row, 124 for the call, 126 and 168 in
 * the composer — and every one of those four was too small for its own longest
 * option: at 96px the text gets 36px, which fits `Low` (28) and `High` (32) and
 * truncates `Medium` (53) and `Not relevant` (81). `Partially approve` (113)
 * truncated in all four. The trigger sizes itself to the widest label it could ever
 * hold now (see the sizer at the label span), so `width` is a floor and truncation
 * is impossible rather than merely unlikely.
 *
 * **`null` is a value it can hold**, and it draws as the placeholder with no icon
 * and no emphasis. It used to fall back to `options[0]` for anything it did not
 * recognise, which is fine for a bad id and wrong for "nobody has chosen": the
 * trigger would print `High` over an item whose importance nobody had set. An
 * unmade choice has to look unmade — see `EvidenceItem` in ../../lib/coverage/fixture.ts.
 */
export function LabelledSelect<V extends string>({
  caption,
  value,
  options,
  onChange,
  icon,
  width,
  valueClassName,
  ariaLabel,
  placeholder = "Choose",
  hint,
  compact = false,
}: {
  caption: string;
  value: V | null;
  options: { value: V; label: string }[];
  onChange: (v: V) => void;
  icon: (v: V) => ReactNode;
  /**
   * The trigger's MINIMUM width. Not its width.
   *
   * The content decides the real one. In a row this wants to be small — enough that
   * `Low` is still a comfortable target, not enough to reintroduce the gap. In the
   * composer it is a real form-field width, because two fields side by side under
   * captions want to look like fields.
   */
  width: number;
  valueClassName?: (v: V) => string;
  ariaLabel: string;
  /** What the trigger reads when `value` is `null`. */
  placeholder?: string;
  /**
   * WHAT THE FIELD IS FOR, on a delayed hover. Omit and no tooltip is wired.
   *
   * The axis, not its values — the scale is on screen already, so "High, medium or
   * low" would be reading the control aloud. `ariaLabel` above still carries the
   * label and the row; this is a description, and Radix wires it as one, so a screen
   * reader gets the two separately rather than one run-together string.
   */
  hint?: string;
  /**
   * THE ROW VARIANT — no caption, no box, 32px tall.
   *
   * A caption over every control is right in the composer, where the reader is
   * filling a form and each field has to name itself. It is wrong down a list: four
   * rows print `IMPORTANCE` and `DECISION` eight times between them, and three bars
   * and a coloured verb had already said it. Without the caption and the resting
   * border the control stops looking like a form field parked in a row and starts
   * looking like part of the line — which is the whole of this variant.
   *
   * It keeps a border only when the value is unset, where a dashed rim is the one
   * thing distinguishing "nobody has answered" from an answer. `cn` is `twMerge`,
   * so the two border colours collapse to one class rather than both landing and
   * racing — which matters more than usual in this app, where a tie between a
   * shell-generated utility and the console's own prebuilt sheet is decided by
   * source order nobody controls.
   */
  compact?: boolean;
}) {
  const current = value === null ? null : options.find((o) => o.value === value) ?? null;
  return (
    /* NO SIZE ON THE WRAPPER. It carries the caption for the form variant and
       nothing else; the trigger below sizes itself. */
    <div className={cn(!compact && "flex flex-col gap-1")}>
      {!compact && (
        <span className={cn(TYPE.label, "pl-0.5 text-muted-foreground")}>{caption}</span>
      )}
      <DropdownMenu>
        {/* THE TOOLTIP WRAPS THE TRIGGER, and both of those words matter.
            `TooltipTrigger asChild` forwards onto `DropdownMenuTrigger`, so one
            element is both — a wrapper element would put a box around the control
            and break the row's gap. And `delayDuration` goes on `Tooltip`, not on a
            provider: `Tooltip` hardcodes a bare `TooltipProvider` at
            `delayDuration = 0` (../ui/tooltip.tsx) and spreads its own props onto
            Radix's Root, where a per-tooltip value beats the provider's. */}
        <Tooltip delayDuration={1200}>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger
              aria-label={ariaLabel}
              /* A FLOOR, and the content decides the rest. `minWidth` rather than
                 `width`, and not `w-full`: a percentage width would sever the box
                 from its own content and settle it on the floor, which is the bug
                 the sizer was invented to patch. Sized from the inside out, the
                 label and the chevron set the width between them. */
              style={{ minWidth: width }}
              className={cn(
                "group flex cursor-pointer items-center gap-2 text-left whitespace-nowrap transition-[background-color,border-color,box-shadow] focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none",
                compact
                  ? cn(
                      // A REAL RIM AT REST. It carried `border-transparent`, which
                      // left a value with a chevron beside it — nothing separating
                      // "this is the answer" from "this is a label". The rim is also
                      // what stops it reading as one of the filed record's
                      // read-only badges, which are the same shape without it.
                      // 28px and 12.5px against the row's 14px: a control set
                      // slightly under the text it sits beside reads as chrome
                      // rather than as another sentence.
                      // 12px at 600 — a step under the row's 14px name and the same size as the
                      // finding's `✓ On us` pills, which are this control's
                      // nearest peers on the page. 12.5/600 read as a second
                      // sentence beside the name rather than as chrome.
                      // WEIGHT 500, NOT 600 — the size was never the problem.
                      // At 12px these are the smallest text on the card, but at 600
                      // they out-weighed the 14px/500 evidence row name they belong
                      // to, so the control read as more important than its own
                      // subject. 500 puts them a step under the name and matches the
                      // fact labels in the record sections.
                      "h-7 rounded-lg border px-2 text-[12px] font-medium hover:bg-accent",
                      // THE OPEN STATE IS THE INPUTS', NOT THE BRAND'S. It was
                      // `border-primary` + `ring-primary/20` — the saturated teal,
                      // which against a 28px control reads as a dark slab and made
                      // this the only control on the card that lights up in the
                      // brand colour when you touch it. Every text input here uses
                      // `border-ring` + `ring-[3px] ring-ring/50` on focus, and so
                      // does this component's own non-compact variant two lines
                      // down — the compact one had simply drifted.
                      // `ring-ring`, WITH NO OPACITY MODIFIER — the modifier is what
                      // was painting this black.
                      //
                      // Measured in the running app: `ring-2 ring-ring/25` and a bare
                      // `ring-2` emit byte-identical shadows,
                      // `lab(11.5667 -1.68552 -15.6442) 0 0 0 2px` — the near-black
                      // text ink. So the colour utility is not emitting and `ring-2`
                      // falls back to `currentColor`. Same for `ring-primary/25`, for
                      // `ring-[var(--ring)]` and for `ring-[color-mix(...)]`: in this
                      // build only the plain, unmodified colour utilities produce a
                      // ring at all. `ring-ring` alone gives
                      // `lab(59.1517 -32.5418 -19.995)`, which is the teal it was
                      // always meant to be.
                      //
                      // Softness therefore comes from WIDTH, not opacity: 2px of the
                      // real colour, which is also what makes it a visible focus
                      // indicator rather than a hairline.
                      "data-[state=open]:border-ring data-[state=open]:ring-2 data-[state=open]:ring-ring",
                      current ? "border-border" : "border-dashed border-border",
                    )
                  : // The composer's variant. 13px rather than the row's 12: it stands
                    // alone under a textarea with a caption over it, where 12 reads as
                    // a hint. `h-9` stays — a field beside a field should look like one.
                    "h-9 rounded-lg border border-border bg-background px-2.5 text-[13px] hover:bg-accent data-[state=open]:border-ring data-[state=open]:ring-2 data-[state=open]:ring-ring",
              )}
            >
              {/* NO EMPTY ICON SLOT. Holding the 18px reserved so the label would
                  not shift on selection sounded careful and looked broken: the
                  placeholder started a centimetre in from the border with nothing in
                  front of it, which reads as a value whose icon failed to load
                  rather than as a field nobody has answered. */}
              {current && (
                <span className="inline-flex shrink-0 items-center justify-center">
                  {icon(current.value)}
                </span>
              )}
              {/* ONE LABEL, NO GHOSTS.
                  A grid of every option rendered `invisible` used to sit here,
                  holding the box at the width of its longest label. It did stop the
                  reflow and it is what put ~90px of nothing between `Approve` and
                  its chevron — see the note at the top. What survives from it is
                  `leading-[1.35]`: the trigger's own line-height is tight enough to
                  clip a descender under `overflow: hidden`, measured as
                  `scrollHeight` 15 against `clientHeight` 14, so the text keeps its
                  own line box. `whitespace-nowrap` is on the trigger, so there is
                  nothing left to truncate against. */}
              <span
                className={cn(
                  "leading-[1.35]",
                  current ? valueClassName?.(current.value) : "font-normal text-muted-foreground",
                )}
              >
                {current ? current.label : placeholder}
              </span>
              <ChevronDown
                aria-hidden
                className="size-3.5 shrink-0 text-muted-foreground transition-transform group-data-[state=open]:rotate-180"
              />
            </DropdownMenuTrigger>
          </TooltipTrigger>
          {hint && (
            /* `bg-app-text text-app-card` OR IT RENDERS DARK ON DARK.
               `TooltipContent` paints `bg-foreground text-background` and portals to
               `document.body`, outside the `.wrc` theme root — where
               `text-background` does not emit at all, so the label inherits the
               shell's near-black ink onto a near-black panel. These two are the
               shell's own paired tokens, both of which resolve out there and which
               invert together. The recommendation tag beside the strip hit this
               first (./decision/DecisionSection.tsx) and this is the same fix. */
            <TooltipContent side="top" className="max-w-64 bg-app-text text-app-card">
              {hint}
            </TooltipContent>
          )}
        </Tooltip>
        <DropdownMenuContent align="end" className={MENU.content} style={{ minWidth: width }}>
          {options.map((o) => (
            <DropdownMenuItem
              key={o.value}
              onSelect={() => onChange(o.value)}
              className={cn(MENU.item, "gap-2.5")}
            >
              <span className="inline-flex w-[18px] shrink-0 justify-center">{icon(o.value)}</span>
              {/* ONE WEIGHT FOR EVERY ROW. The selected one was also semibold, which
                  gave a four-item list two type weights and made it look mis-set —
                  and the `Check` beside it was already the marker. */}
              <span className="flex-1 whitespace-nowrap">{o.label}</span>
              {o.value === value && <Check className="size-3.5 text-primary" />}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** Importance as three bars, filled by rank — or a dash, off the scale. */
export function RankBars({ value }: { value: Importance }) {
  /**
   * NOT ZERO BARS — A DASH.
   *
   * `not-relevant` is not the bottom of the ladder, it is beside it
   * (`Importance` in ../../lib/coverage/fixture.ts), and three empty bars would
   * draw it as a rank of zero: on the scale, just very small. A flat rule reads
   * as "no rank" instead.
   *
   * 12×10 matches the bars below — three at 3px with two 1.5px gaps — so the
   * slot does not change shape between values.
   */
  if (value === "not-relevant") {
    return (
      <span aria-hidden className="inline-flex h-[10px] w-3 items-end justify-center">
        <i className="block h-[3px] w-full rounded-[1px] bg-border" />
      </span>
    );
  }

  const filled = { high: 3, medium: 2, low: 1 }[value];
  return (
    <span aria-hidden className="inline-flex h-[10px] items-end gap-[1.5px]">
      {[4, 7, 10].map((h, i) => (
        <i
          key={h}
          style={{ height: h }}
          /**
           * ONE HUE, THREE INTENSITIES — the level is in the colour, not only in
           * the count.
           *
           * All three filled bars used to be one flat `bg-primary`, so the icon
           * said the level by height alone and the word beside it did the rest.
           * A ramp says it twice in one glyph, which is what lets the label go
           * neutral.
           *
           * **A single hue rather than red/amber/grey, and that is the whole
           * argument.** This row already spends green and red on the CALL — the
           * dot on its left, the finding's pills above. Severity hues here would
           * put red on a row whose call is Approve and leave red meaning two
           * things on one screen. An ordinal scale wants one hue stepped, and
           * importance is ordinal.
           *
           * The three are written out as LITERAL classes. Tailwind generates
           * nothing from an interpolated string, so a `bg-[…${n}%…]` would
           * type-check, compile, and paint no colour at all — which is how this
           * app has been bitten before (`Pill` in ./primitives.tsx).
           */
          className={cn(
            "block w-[3px] rounded-[1px]",
            i >= filled
              ? "bg-border"
              : i === 2
                ? "bg-primary"
                : i === 1
                  ? "bg-[color-mix(in_oklab,var(--primary)_62%,var(--border))]"
                  : "bg-[color-mix(in_oklab,var(--primary)_38%,var(--border))]",
          )}
        />
      ))}
    </span>
  );
}

export function CallDot({ value }: { value: EvidenceCall }) {
  /**
   * A BARE GLYPH, NOT A CHIP.
   *
   * It was a 17px tinted rounded box, which made a third bordered object out of
   * something standing inside a bordered control, next to a bordered row. The
   * colour was the only part doing work; the box was carrying it.
   *
   * **`±` for partial.** Two glyphs came before it and both were wrong: `◑`, a
   * half-filled circle that reads as a smudge at 11px and is easy to mistake for
   * a full one, and `½`, which was legible and looked like a measurement rather
   * than a verdict.
   *
   * `±` is the one that means the thing. A partial approval is not half a
   * decision, it is some of the claim allowed and some refused — the resolution
   * card next to it says "Split cost" — and `±` is exactly "part one way, part
   * the other". It is also two strokes like the marks either side of it, so the
   * three sit as a set: `✓` `±` `✗`. And it is distinct from the importance
   * dash, which a plain `–` would not have been.
   */
  const glyph = { approve: "✓", partial: "±", deny: "✗" }[value];
  return (
    <span
      aria-hidden
      className={cn(
        "shrink-0 text-[11px] leading-none font-extrabold",
        value === "approve" && "text-success",
        value === "partial" && "text-warning-foreground",
        value === "deny" && "text-destructive",
      )}
    >
      {glyph}
    </span>
  );
}

/*
 * `callInk` USED TO LIVE HERE, and its removal is the point of this pass.
 *
 * It painted the trigger's LABEL green, amber or red to match the call. Between
 * it, the boxed `CallDot`, the row's own left dot and the finding's pills, one
 * screen carried four separate green/red systems — and the two on the control
 * were the two a reader does not need, because the row's dot is six pixels to the
 * left of the name and says the same thing. The word is ink now; the colour is on
 * the glyph and the dot.
 */
