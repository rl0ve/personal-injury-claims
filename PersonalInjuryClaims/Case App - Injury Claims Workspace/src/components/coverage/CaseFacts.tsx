import { Building2, Cog, MapPin, ShieldCheck, Star } from "lucide-react";
import { Card, CardHead, INK, Label, Mono, ToneChip, TYPE } from "@/components/coverage/primitives";
import { Finding } from "@/components/coverage/Finding";
import { moneyExact } from "@/lib/claims/format";
import type { CaseAction, InjuryClaim } from "@/lib/claims/types";
import { cn } from "@/lib/utils";

/**
 * THE CASE BAND — who, what, where, under which policy; the claim as the figure
 * the page is about; and the escalation reason as a lede.
 *
 * The claimant is the block's headline with its segment beside it; the injury, the
 * incident location and the policy follow as one icon-led meta line. The claim and the
 * escalation reason then sit side by side as two bordered panels, the claim at
 * 24/700 because that number is what every control below is arguing about.
 *
 * It is a glass `Card` with `p-5` and a `CardHead`, like every other card in
 * injury claims resolution. It used to be a two-column grid that bled to its own
 * corners — the claim in a `bg-muted/40` well welded to the right edge, the reason
 * in a full-bleed strip under it — which is why it could not have padding and why
 * both of those had to invent a background to separate themselves.
 */
export function CaseFacts({ action, claim }: { action: CaseAction; claim: InjuryClaim }) {
  const claimTotal = action.claimTotal ?? claim.claimValue;
  const limit = action.authority?.limit;

  const tail = serialTail(claim.asset.model, claim.asset.serial);
  // `site` is authored as one string, "A41 Watford Road · northbound carriageway".
  // Split for display only: the place is what a reader scans for and the rest qualifies it,
  // so they want different weights. The data stays one field — it is one field
  // everywhere else that reads a case.
  const [place, ...restOfSite] = claim.site.split(" · ");
  const line = restOfSite.join(" · ");
  const [agreementRef, ...restOfAgreement] = shortAgreement(
    claim.asset.coverageStatus,
  ).split(" · ");
  const agreementRest = restOfAgreement.length ? ` · ${restOfAgreement.join(" · ")}` : "";

  return (
    <Card className="flex flex-col gap-4 p-5">
      <CardHead title="Case info" icon={<Building2 />} />

      {/* THE CLAIMANT IS THE HEADLINE; EVERYTHING ELSE IS ONE META LINE.
          It was four label-over-value facts in a 3-column grid, two rows tall, and
          each of the three besides the claimant was carrying a fault:

            · Policy printed the cover name and then the policy number, whose first
              characters ARE the cover name — the row said it twice.
            · Incident location was one string with a middot standing in for a
              hierarchy.
            · Policy was three facts joined by middots, opening with words that the
              reference immediately after them restates.

          Labels went with them. This is the case page's own hero pattern — a name,
          then an icon-led strip of facts (`CaseDetailPage`'s `Policy · Claim value ·
          Owner` line is the same thing) — so the icons carry what the labels did,
          and the block drops from 181px to about 134. */}
      <div>
        <div className="flex flex-wrap items-center gap-2">
          {/* 16/700 against the card head's 16/600. Weight and ink separate them
              rather than a seventh type size: the mock drew this at 18px, which is
              a rung neither this page nor the rest of the app has. */}
          <span className={cn(TYPE.title, "font-bold")}>{claim.customer}</span>
          {claim.customerSegment && (
            <ToneChip tone="brand">
              <Star className="size-3.5 shrink-0 text-primary" aria-hidden />
              {claim.customerSegment}
            </ToneChip>
          )}
        </div>

        <div
          className={cn(
            TYPE.small,
            "mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-muted-foreground",
          )}
        >
          <MetaFact icon={<Cog />}>
            <b className="font-semibold text-foreground">{claim.asset.model}</b>
            {tail && <Mono>·{tail}</Mono>}
          </MetaFact>
          <Rule />
          <MetaFact icon={<MapPin />}>
            <b className="font-semibold text-foreground">{place}</b>
            {line}
          </MetaFact>
          <Rule />
          <MetaFact icon={<ShieldCheck />}>
            <b className="font-semibold text-foreground">{agreementRef}</b>
            {agreementRest}
          </MetaFact>
        </div>
      </div>

      {/* THE CLAIM AND THE REASON, AS TWO BORDERED PANELS.
          They were a tinted well bolted to the card's right edge and a full-bleed
          strip under it — `bg-muted/40` and a `border-t`, two devices this app
          uses nowhere. A panel with one rim on `bg-card` is what the rest of
          injury claims resolution puts a figure or a paragraph in (see `SlaRow` and
          `OpenActionCard`), and it lets the card have padding like every other
          card instead of having to bleed to its own corners. */}
      {/* FLEX, NOT AN ARBITRARY GRID TEMPLATE — and this is the hazard this app
          keeps re-teaching. `lg:grid-cols-[300px_minmax(0,1fr)]` type-checks,
          compiles, and computes to a single 1090px column on the running page:
          the console ships a PREBUILT stylesheet nested in `.wrc`
          (../../../claims-console/claims-console.css) that the shell's own
          Tailwind competes with at equal specificity, and an arbitrary value the
          prebuilt sheet has never seen is not reliably generated. `lg:grid-cols-2`
          right below works because that class IS in the sheet.
          `flex` + `lg:flex-row` + `lg:w-[300px]` are all utilities the app already
          uses, so they are all in it. */}
      <div className="flex flex-col gap-4 lg:flex-row">
        <div className="rounded-xl border border-border bg-card p-4 lg:w-[300px] lg:shrink-0">
          <Label>Claim</Label>
          <span className={cn(TYPE.figure, "mt-1 block")}>{moneyExact(claimTotal)}</span>
          {/* ONE FACT UNDER THE FIGURE, AND IT IS THE ONE THAT CONSTRAINS THE
              READER. The line count used to lead this caption — "4 lines · your
              ceiling is …" — and it answers a question nobody asks here: the
              breakdown is a disclosure inside the decision's refund panel, which
              is where somebody acting on it looks. The ceiling is what every
              control below is measured against, so it gets the caption to itself
              rather than trailing a list. Written as a label and its value, not as
              a sentence — it is a constraint the reader looks up, and "Approval
              ceiling: $5,000.00" is scanned in one movement where "Your approval
              ceiling is $5,000.00" has to be read. */}
          <span className={cn(TYPE.small, INK.ink2, "mt-1 block")}>
            {limit ? (
              <>
                Approval ceiling:{" "}
                <b className="font-semibold tabular-nums text-foreground">{moneyExact(limit)}</b>
              </>
            ) : null}
          </span>
        </div>

        <div className="min-w-0 flex-1 rounded-xl border border-border bg-card p-4">
          <Label>Description</Label>
          <p className={cn(TYPE.body, "mt-1 leading-relaxed text-foreground")}>
            {action.whyThisReachedYou}
          </p>
        </div>
      </div>

      {/* ── THE FINDING, IN THIS CARD ──────────────────────────────────────
          What was established about the claim belongs with the facts of the
          claim: the two causes and what follows from them are what the case IS.
          It used to sit in a card of its own with the evidence
          (./CaseInfo.tsx, now gone) and the evidence has moved under the
          decision it feeds (./decision/DecisionSection.tsx), which is what
          split the two apart.

          It needs no wrapper any more. The card was a two-column grid, so a
          fragment dropped in here had its band, each cause row and the verdict
          note laid out as separate grid cells in the wrong order, and a
          `col-span-2` div existed only to stop that. The card is a flex column
          now and `Finding` returns its own bordered `Rows` group, so it is just
          the next child. */}
      <Finding action={action} />
    </Card>
  );
}

/** One icon-led fact on the meta line. */
function MetaFact({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      <span className="flex shrink-0 [&>svg]:size-3.5">{icon}</span>
      {children}
    </span>
  );
}

/**
 * A hairline between two facts on the meta line.
 *
 * It wraps with its neighbours rather than being suppressed at a line end: a 1px
 * 14px-tall tick that lands first on a wrapped line reads as part of the rhythm,
 * and suppressing it would need to know where the browser broke, which CSS cannot
 * say. At 1180px the line does not wrap at all.
 */
function Rule() {
  return <span aria-hidden className="h-3.5 w-px shrink-0 bg-border" />;
}

/**
 * THE POLICY NUMBER MINUS THE COVER NAME IT REPEATS.
 *
 * A policy number that opens with its own cover name is the name, a separator, and
 * then the characters that actually identify the policy. Printing both put the same
 * characters on the line twice.
 *
 * Compares alphanumerics only, so punctuation in the cover name does not matter.
 * Returns the number UNTOUCHED whenever it does not start with
 * the model, or when stripping the model would leave nothing — a serial that is not
 * built this way is not this function's business, and a blank is worse than a
 * repeat.
 */
function serialTail(model: string, serial: string): string {
  const key = model.replace(/[^a-z0-9]/gi, "").toLowerCase();
  if (!key) return serial;
  let seen = "";
  for (let i = 0; i < serial.length; i++) {
    if (/[a-z0-9]/i.test(serial[i])) seen += serial[i].toLowerCase();
    if (seen === key) return serial.slice(i + 1).replace(/^[^a-z0-9]+/i, "") || serial;
    if (!key.startsWith(seen)) return serial;
  }
  return serial;
}

/**
 * The policy string without its type name.
 *
 * "Personal Injury Cover NRD-PIC-2024-0219 · active to …" opens with words
 * that the reference immediately after them restates — the `PIC` is right
 * there in the id — and the row carries a shield. So the type name goes and nothing
 * else is touched: no re-ordering, no re-wording, and an unrecognised opening is
 * returned whole rather than guessed at.
 */
function shortAgreement(status: string): string {
  return status.replace(/^((Personal\s+)?Injury\s+Cover|Extended Service|Standard|Master|Service)(\s+(Service\s+)?Agreement)?\s+/i, "");
}
