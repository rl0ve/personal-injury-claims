import { useRef, useState } from "react";
import { Building2, ExternalLink, FileText, Info, Layers, Plus } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Mono, Section, TYPE } from "@/components/coverage/primitives";
import { dateOnly, money } from "@/lib/claims/format";
import type { InjuryClaim } from "@/lib/claims/types";
import { assetUrl } from "@/lib/app-base";
import { cn } from "@/lib/utils";
// READ-ONLY reach into the Signal Collector's shared data, the same way v1 reads it.
// The base rate and the document list are the same for every console; what this page
// authors for itself lives in ../../lib/coverage/fixture.ts.
import { documentsForCase, precedentForCase } from "@/lib/coverage/data/case-sections";
import { coverageOption } from "@/lib/coverage/data/coverage-decision";

/**
 * THE THREE FOLDED SECTIONS UNDER THE CASE — the record, not the argument.
 *
 * Each closed row answers its own question, so opening any of them is optional and
 * all three arrive shut. They are glass cards like the two open ones above them,
 * with a 56px head carrying a 16px title, so the five blocks read as five of one
 * thing rather than as two cards and three strips. Each body lays its facts out in
 * rows of one rhythm rather than in three unrelated shapes — a paragraph over a
 * stacked bar over a table, a 180px-gutter key/value table, and seven four-line
 * blocks with a bordered button each.
 *
 * **Compacting these was worth more than compacting anything else on the page.**
 * Open, they came to 1,093px between them — Documents alone was 578, larger than
 * the whole Decision card. They now come to 614.
 */

/**
 * A GROUP HEADING INSIDE A SECTION — one tier below `Band`.
 *
 * `Band` (../coverage/primitives.tsx) is 40px with a 14px semibold title, which is
 * the weight of a section's own head: five of them inside three sections would
 * compete with the heads they sit under. This is the treatment `Band` itself
 * carried until recently — a 10px uppercase label on `bg-muted/50` between two
 * hairlines, recorded in ./Finding.tsx's note — kept here as the sub-level it was
 * always better suited to being.
 *
 * Local rather than exported: it exists to group facts inside the three folded
 * sections, and a fourth caller would be a reason to look again rather than to
 * import it.
 */
function Group({ title, count }: { title: string; count?: number }) {
  return (
    /* `first:border-t-0`, because otherwise removing the head's `border-b` gains
       nothing: the first group in a section sits directly under the head, and its
       own top rule would land in the same pixel row the head's used to. Later
       groups keep theirs — those are boundaries between clusters, which is the
       line's actual job. */
    <div className="flex items-center justify-between gap-3 border-y border-border/60 bg-muted/50 px-5 py-1.5 first:border-t-0">
      <span className={cn(TYPE.label, "text-muted-foreground")}>{title}</span>
      {count !== undefined && <Mono>{count}</Mono>}
    </div>
  );
}

/** One fact, as a line: name left, value right. The evidence list's own rhythm. */
/**
 * ONE FACT, AND — WHERE THE SECTION CAN PRODUCE A READING — A WAY TO FILE IT.
 *
 * `onAdd` is optional and that is the whole gate: a section passes it only when the
 * reading table has an entry for that section, so Similar claims and Documents render the
 * row they always did while `This claimant` gets a button. The rule is the table's
 * own (../../../../_components/evidence-capture/evidence-templates.ts): a source
 * earns a reading when somebody has decided what a fact there MEANS as evidence.
 *
 * ## The reveal is state and an inline style, NOT `group-hover:`
 *
 * The obvious version — `opacity-0 group-hover:opacity-100` — was written, shipped
 * and reported as a bug within the hour: **the button was invisible at every
 * state while still being clickable.** It is the standing hazard ./EvidenceList.tsx
 * describes, and knowing about it was not enough to avoid it, so here is the
 * mechanism concretely.
 *
 * Two stylesheets style this folder. The console's prebuilt one
 * (../../../claims-console/claims-console.css) contains `.opacity-0`; the
 * shell's Tailwind build contains `.group-hover\:opacity-100`. Both are one class
 * of specificity, so the winner is whichever sits later in the document — and the
 * console's sheet is loaded after. `opacity: 0` therefore wins on hover too, and
 * no amount of checking that `group-hover:opacity-100` "is emitted" catches it,
 * because it IS emitted; it just loses.
 *
 * So the row tracks its own hover and focus, and the two things that change are
 * written as inline styles, which neither sheet can outvote. It is the same
 * reasoning ../coverage/primitives.tsx gives for writing the chevron's rotation
 * inline, and the same conclusion: in this folder, a value that has to change on
 * an interaction is a style, not a variant.
 *
 * Two things follow from that and both are wanted. **Tab reaches it** without a
 * pointer ever being near the row, and `focus-within` makes the focused one
 * visible.
 *
 * **It stays clickable while transparent, and that is not the oversight it looks
 * like.** The obvious guard is `pointer-events-none` lifted by a
 * `group-hover:pointer-events-auto` — and that variant is NOT emitted in this
 * folder (measured: zero rules in either stylesheet, while every other class on
 * this button is present). It is also not needed: a pointer cannot reach the
 * button without first entering the row, which is what makes it opaque, so the
 * invisible-but-clickable state is unreachable by mouse. The one case it IS
 * reachable in is touch, where there is no hover at all — and a tap at the row's
 * right edge opening the composer is a reasonable affordance rather than a bug.
 * `pointer-events-none` with no way to lift it would break the mouse entirely.
 *
 * ## The value slides rather than being covered
 *
 * `group-hover:pr-[104px]` on the value, so the fact moves aside for the button
 * instead of sitting under it. It is padding rather than a margin or a width so the
 * box's right edge — which the composer anchors to — does not move while the text
 * inside it does.
 */
function FactLine({
  label,
  value,
  onAdd,
}: {
  label: string;
  value: React.ReactNode;
  /** Given the row's own element, so the caller can read its rect. */
  onAdd?: (row: HTMLElement, read: string) => void;
}) {
  const row = useRef<HTMLDivElement>(null);
  /**
   * Pointer over the row, or focus inside it. One flag for both, because the
   * button should appear for the same reason either way — somebody has arrived at
   * this row and might act on it.
   *
   * `onFocus`/`onBlur` on the container rather than the button: focus events bubble
   * in React, so the container hears the button's without a second pair of
   * handlers, and the value's padding is the container's business anyway.
   */
  const [lit, setLit] = useState(false);
  const show = Boolean(onAdd) && lit;

  return (
    <div
      ref={row}
      onMouseEnter={() => onAdd && setLit(true)}
      onMouseLeave={() => setLit(false)}
      onFocus={() => onAdd && setLit(true)}
      onBlur={() => setLit(false)}
      className="relative flex min-h-[34px] items-center gap-4 border-b border-border/60 px-5 transition-colors last:border-0 hover:bg-muted/50"
    >
      <span className={cn(TYPE.small, "shrink-0 font-medium")}>{label}</span>
      {/* The value slides rather than being covered. Padding, so the box's right
          edge — which the composer anchors to — stays put while the text moves. */}
      <span
        className={cn(TYPE.small, "ml-auto text-right text-muted-foreground transition-[padding]")}
        style={{ paddingRight: show ? 104 : 0 }}
      >
        {value}
      </span>

      {onAdd ? (
        <button
          type="button"
          onClick={() => {
            if (row.current) onAdd(row.current, `${label} — ${textOf(value)}`);
          }}
          style={{ opacity: show ? 1 : 0 }}
          className="absolute top-1/2 right-3 flex h-6 -translate-y-1/2 items-center gap-1.5 rounded-md border border-border bg-card px-2 text-[11.5px] font-semibold whitespace-nowrap shadow-sm transition-opacity focus-visible:ring-2 focus-visible:ring-ring/50 focus-visible:outline-none"
        >
          <Plus className="size-3 shrink-0 text-primary" aria-hidden />
          Add evidence
        </button>
      ) : null}
    </div>
  );
}

/**
 * The row read aloud, for the composer's echo line and the item's subject.
 *
 * `value` is a `ReactNode` because two callers pass elements, so this cannot just
 * be a string cast. Only strings and numbers appear in practice — the claimant
 * section's values are all interpolated strings — and anything else contributes
 * nothing rather than `[object Object]`.
 */
function textOf(value: React.ReactNode): string {
  if (typeof value === "string" || typeof value === "number") return String(value);
  if (Array.isArray(value)) return value.map(textOf).join(" ");
  return "";
}

export function HistorySection({ caseId }: { caseId: string }) {
  const precedent = precedentForCase(caseId);
  if (!precedent) return null;
  const total = precedent.shares.reduce((n, s) => n + s.cases, 0);
  const ranked = [...precedent.shares].sort((a, b) => b.cases - a.cases);
  const lead = ranked[0];
  const pct = (n: number) => Math.round((n / total) * 100);
  const label = (id: (typeof ranked)[number]["option"]) => {
    const s = coverageOption(id).action;
    return s.charAt(0).toUpperCase() + s.slice(1);
  };

  return (
    <Section
      /* "Similar claims", NOT "History" — a correction rather than a rename. The
         section renders PRECEDENT (`precedentForCase`): comparable cases and how
         they were resolved, which is what its own summary has always said —
         "6 similar cases · 67% partial coverage". Only the title called it
         history, and a reader who took that at face value would expect this
         case's own timeline, which is the Activity feed.

         `Layers` for the same reason: the lucide `History` glyph is a clock with
         an arrow round it, which is elapsed time. These are parallel cases. */
      title="Similar claims"
      icon={<Layers />}
      // "6 similar cases · 67% partial coverage". It read "comparable" and "went
      // partial coverage" — a longer word for `similar` and a verb the percentage
      // did not need.
      summary={`${total} similar cases · ${pct(lead.cases)}% ${coverageOption(lead.option).action}`}
    >
      {/* OUTCOMES THAT HAPPENED, THEN WHAT QUALIFIES THEM.
          A row for an outcome with no cases in it was a bar of zero width, a `0%`
          and `0 cases` — three ways of printing an absence, taking a line to do it.
          The absences move into the footer as a clause, which is where the window
          and the match criteria already were. */}
      {ranked
        .filter((s) => s.cases > 0)
        .map((s, i) => (
          <div key={s.option} className="flex h-9 items-center gap-3 px-5">
            <span className={cn(TYPE.small, "w-[104px] shrink-0")}>{label(s.option)}</span>
            <span className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-muted">
              <span
                style={{ width: `${pct(s.cases)}%` }}
                className={cn("block h-full rounded-full", i === 0 ? "bg-primary" : "bg-primary/45")}
              />
            </span>
            <span className={cn(TYPE.small, "w-[58px] shrink-0 text-right font-semibold tabular-nums")}>
              {pct(s.cases)}%
            </span>
            <span className={cn(TYPE.small, "w-[18px] shrink-0 text-right text-muted-foreground tabular-nums")}>
              {s.cases}
            </span>
          </div>
        ))}
      <div className="mt-1.5 border-t border-border/60 bg-muted/50 px-5 py-1.5">
        <Mono>
          {precedent.window} · matched on {precedent.criteria}
          {ranked.some((s) => s.cases === 0) &&
            ` · no ${ranked
              .filter((s) => s.cases === 0)
              .map((s) => coverageOption(s.option).action)
              .join(" or ")}`}
        </Mono>
      </div>
    </Section>
  );
}

export function CustomerSection({
  claim,
  history,
  onCapture,
}: {
  claim: InjuryClaim;
  history: [string, string][];
  /**
   * OFFER A ROW AS EVIDENCE — the same shape a drag produces, built from a row.
   *
   * This is the only section that gets it, because `customer` is the only source
   * with a reading. Optional so the page can leave it off and the rows go back to
   * being facts, which is also what makes this safe to add: nothing renders
   * differently until a caller asks for it.
   */
  onCapture?: (selection: {
    text: string;
    via: "row";
    rect: { top: number; left: number; width: number };
    source: string;
  }) => void;
}) {
  const s = claim.standing;
  // The two-up grid gives a label 136px, and one label from the shared fixture is
  // longer than that. Shortened here rather than there: the fixture is read by v1
  // as well, where the gutter is wide enough and the full wording is right.
  const SHORT: Record<string, string> = { "Claims filed, 24 months": "Claims, 24 months" };
  /**
   * THREE CLUSTERS, NOT SIX ROWS IN A GRID.
   *
   * The six facts were a flat `KeyValueGrid` with a 180px label gutter, six full
   * -width rows, 600px of card for six short answers. They are not six unrelated
   * things: three describe the claimant's claims record, two the policy it runs
   * under, one is a person. Named and grouped, the section is scanned rather than
   * read — and the names are the one thing the flat grid could not carry.
   *
   * Derived rather than sliced by index: `history` is the shared fixture's and can
   * be any length, and the agreement rows only exist where there is standing.
   */
  const claims: [string, React.ReactNode][] = history.map(([k, v]) => [SHORT[k] ?? k, v]);
  const agreement: [string, React.ReactNode][] = s
    ? [
        ["Policy", `${money(s.annualValue)}/yr · renews ${dateOnly(s.renewalDate)}`],
        ["Credits YTD", `${money(s.slaCreditsYtd)} · ${s.goodwill12mo > 0 ? `${money(s.goodwill12mo)} goodwill` : "no goodwill"} in 12 months`],
      ]
    : [];
  const contact: [string, React.ReactNode][] = s ? [["Claimant contact", `${s.contactName} · ${s.contactRole}`]] : [];
  // "6 claims · all approved". "· first on this policy" came off: it is one of the
  // three lines in the cluster below, and a summary that lists its own contents
  // stops summarising.
  const summary = history[0]?.[1] ? `${history[0][1].split(" — ")[0]} claims · all approved` : "";

  /**
   * The row's rect, in the viewport coordinates the bar reads.
   *
   * `source` is hard-coded rather than re-derived from the DOM: the wrapper below
   * declares `data-evidence-source="customer"` for the drag path, and a button in
   * here is by definition in that section. Reading it back out of the ancestry
   * would be asking the DOM a question this component already knows the answer to.
   */
  const capture = onCapture
    ? (row: HTMLElement, read: string) => {
        const box = row.getBoundingClientRect();
        onCapture({
          text: read,
          via: "row",
          rect: { top: box.top, left: box.left, width: box.width },
          source: "customer",
        });
      }
    : undefined;

  return (
    /**
     * NAMED AS AN EVIDENCE SOURCE, which is what lets a selection in here become
     * an evidence item.
     *
     * The capture bar reads the nearest `data-evidence-source` above the selection
     * and looks the name up in its own table
     * (../../../../_components/evidence-capture/evidence-templates.ts). A section
     * with no such attribute still raises the bar and commits nothing — the bar is
     * one widget over the whole record, and this is how it knows which part of the
     * record it is standing on.
     *
     * **A wrapper with `display: contents`, not a prop on `Section`.** `closest()`
     * walks the DOM whatever the display is, so the attribute is findable while the
     * box disappears from layout — the section stays a direct flex child of the
     * column and nothing moves by a pixel. It is a wrapper rather than a `Section`
     * prop because that primitive is shared by four sections and is being edited
     * elsewhere; this keeps the change to the one section that needed it.
     */
    <div data-evidence-source="customer" style={{ display: "contents" }}>
      <Section title="This claimant" icon={<Building2 />} summary={summary}>
        <Group title="Claims record" count={claims.length} />
        {claims.map(([k, v]) => (
          <FactLine key={k} label={k} value={v} onAdd={capture} />
        ))}
        {agreement.length > 0 && (
          <>
            <Group title="Policy" count={agreement.length} />
            {agreement.map(([k, v]) => (
              <FactLine key={k} label={k} value={v} onAdd={capture} />
            ))}
          </>
        )}
        {contact.length > 0 && (
          <>
            <Group title="Contact" />
            {contact.map(([k, v]) => (
              <FactLine key={k} label={k} value={v} onAdd={capture} />
            ))}
          </>
        )}
      </Section>
    </div>
  );
}

export function DocumentsSection({ caseId }: { caseId: string }) {
  const docs = documentsForCase(caseId);
  if (docs.length === 0) return null;
  /**
   * CONSIDERED, THEN THE REST — and the split was already being counted.
   *
   * The head has always said "7 attached · 4 read from" over a flat list of seven
   * that gave no way of telling which four. The one distinction the section states
   * about itself was the one thing it did not show.
   *
   * The grouping and the fold are the same fact: a document in `Considered` has a
   * reading taken off it, which is exactly what `DocumentRow` opens to show, so
   * every row in the first group has a chevron and none in the second does.
   */
  const considered = docs.filter((d) => d.readOff);
  const other = docs.filter((d) => !d.readOff);

  return (
    <Section
      title="Documents"
      icon={<FileText />}
      summary={`${docs.length} attached · ${considered.length} considered`}
    >
      {considered.length > 0 && (
        <>
          <Group title="Considered" count={considered.length} />
          <ul className="m-0 list-none p-0">
            {considered.map((d) => (
              <DocumentRow key={d.id} doc={d} />
            ))}
          </ul>
        </>
      )}
      {other.length > 0 && (
        <>
          <Group title="Other documents" count={other.length} />
          <ul className="m-0 list-none p-0">
            {other.map((d) => (
              <DocumentRow key={d.id} doc={d} />
            ))}
          </ul>
        </>
      )}
    </Section>
  );
}

/**
 * ONE DOCUMENT, ONE LINE — AND THE LINE DOES NOT OPEN ANY MORE.
 *
 * The reading taken off a document used to be a paragraph the row expanded to
 * show: a chevron on the left, a click, and a sentence underneath. Three things
 * were wrong with that. It made every row look like a container when four of the
 * seven had nothing inside them; it put a one-sentence finding two interactions
 * deep; and the paragraph wrapping inside the card's width grew the row to about
 * 300px, which is what made this section the tallest thing on the page.
 *
 * It is a tooltip on an info icon now, beside `Open`. The sentence is short, it is
 * a gloss on the row rather than content of its own, and a gloss is what a tooltip
 * is for.
 *
 * **THE SLOT IS HELD WHEN THERE IS NO READING.** Only the four documents in
 * `Considered` have one — that is what the group means — so three rows have no
 * icon, and without a spacer their `Open` buttons would sit 32px right of the
 * other four. An empty `size-7` keeps one column of `Open` down the whole list.
 *
 * **`bg-app-text text-app-card` on the content, or it is invisible.**
 * `TooltipContent` paints `bg-foreground text-background` and portals to
 * `document.body`, outside the `.wrc` theme root, where `text-background` does not
 * resolve — the same trap the evidence selectors and the recommendation tag both
 * hit (../coverage/LabelledSelect.tsx).
 *
 * **300ms rather than the selectors' 1200.** Those delay because a pointer sweeps
 * across a row of controls on its way somewhere; this is a 28px target somebody
 * aims at, and the sentence it holds is the whole reason the icon is there.
 */
function DocumentRow({ doc }: { doc: ReturnType<typeof documentsForCase>[number] }) {
  return (
    <li className="border-b border-border transition-colors last:border-0 hover:bg-muted/40">
      <div className="flex min-h-11 items-center gap-3 px-5">
        <span className={cn(TYPE.body, "shrink-0 font-medium")}>{doc.title}</span>
        <span className={cn(TYPE.small, "min-w-0 flex-1 truncate text-muted-foreground")}>
          {doc.issuer}
        </span>

        {doc.readOff ? (
          <Tooltip delayDuration={300}>
            <TooltipTrigger asChild>
              <button
                type="button"
                aria-label={`What was read off ${doc.title}`}
                className="grid size-7 shrink-0 cursor-help place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
              >
                <Info className="size-4" aria-hidden />
              </button>
            </TooltipTrigger>
            <TooltipContent side="top" className="max-w-72 bg-app-text text-app-card">
              {doc.readOff}
            </TooltipContent>
          </Tooltip>
        ) : (
          <span aria-hidden className="size-7 shrink-0" />
        )}

        <button
          type="button"
          onClick={() => window.open(assetUrl(doc.href), "_blank", "noopener,noreferrer")}
          title="Open"
          aria-label={`Open ${doc.title}`}
          className="grid size-7 shrink-0 cursor-pointer place-items-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-primary focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none"
        >
          {/* 28px of target around a 16px glyph — the row is 44px, and a bare
              icon at its own size is the target nobody hits that `FoldRow`'s note
              is about. */}
          <ExternalLink className="size-4" aria-hidden />
        </button>
      </div>
    </li>
  );
}
