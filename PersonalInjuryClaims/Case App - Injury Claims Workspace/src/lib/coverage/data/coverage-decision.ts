/**
 * THE LIABILITY AND QUANTUM DECISION MODEL — the data the console's decision
 * column derives from.
 *
 * Everything the reader can change the shape of lives here: the claim's lines,
 * the three liability positions, and what each position does to the money, the
 * approval route, the drafted rationale and the downstream effects. The view
 * computes; it holds no copy of these numbers
 * (../_views/coverage-decision-console).
 *
 * **Why this is data and the rest of the console isn't.** The narrative panels —
 * the timeline, the finding, the policy test, the cost table, the history — are
 * a fixed account of one case, read top to bottom and never recomputed, so they
 * live as markup in the view. These figures are different: three positions each
 * reallocate the same four lines, and the authority meter, the submit button and
 * the on-submit list are all READ OFF that reallocation. Written twice, they
 * would eventually disagree, and a console that says "£9,690" in one place and
 * routes for co-approval in another is worse than one that says nothing.
 *
 * Ported from the standalone prototype (coverage-decision-console.html). Its
 * inline HTML in strings — `<u>…</u>` tails, `<b>…</b>` names — is structured
 * into fields here, because JSX renders text and the markup was only ever
 * carrying which part was muted.
 */

/** Pounds, as a number — formatted at the edge, never stored pre-formatted. */
export type Usd = number;

/** The delegated signing limit of the person on the case. */
export const DECISION_LIMIT: Usd = 10_000;

/** One line of the claim as filed. Keys are referenced by every allocation. */
export type ClaimLineKey = "parts" | "labour" | "travel" | "freight";

export interface ClaimLine {
  key: ClaimLineKey;
  /** Short form for the attribution table — the cost table spells it out. */
  label: string;
  amount: Usd;
}

export const CLAIM_LINES: ClaimLine[] = [
  { key: "parts", label: "General damages — assessed", amount: 8_450 },
  { key: "labour", label: "Special damages — earnings", amount: 2_682.5 },
  { key: "travel", label: "Care & rehabilitation", amount: 1_240 },
  { key: "freight", label: "Medical & treatment", amount: 3_900 },
];

/**
 * The claim total. DERIVED from the lines rather than restated, so the header
 * tile, the cost table and the attribution footer cannot drift from each other
 * — the rule the case's `FINDINGS_TOTAL` follows for the same reason.
 */
export const CLAIM_TOTAL: Usd = CLAIM_LINES.reduce((sum, l) => sum + l.amount, 0);

/** Who a line's cost lands on. */
export type Payer = "provider" | "customer";

export interface LineAllocation {
  to: Payer;
  /** Why this line landed there — the muted line under its name. */
  why: string;
  /** Absorbed as goodwill rather than owed: the figure prints in green. */
  goodwill?: boolean;
}

/** One row of the "on submit" list. */
export interface DownstreamEffect {
  text: string;
  /** The muted tail after the effect ("— £9,690.00 reserve"). */
  detail?: string;
  /** Held pending an approval this decision triggers — prints amber. */
  hold?: boolean;
}

export type CoverageOptionId = "deny" | "full" | "partial";

export interface CoverageOption {
  id: CoverageOptionId;
  /** The option card's heading. */
  title: string;
  /** The line under it. */
  blurb: string;
  /** Marks the position the case plan arrived at. Exactly one carries it. */
  recommended?: boolean;
  /** Tail of the submit button ("Submit — partial admission"). */
  action: string;
  /** The confirmed state's headline. */
  doneTitle: string;
  allocation: Record<ClaimLineKey, LineAllocation>;
  /**
   * The rationale the agent drafted. Empty where the position departs from the
   * recommendation: the person has to write that one themselves, which is the
   * point of `override`.
   */
  draft: string;
  /** Departs from the recommendation, so the rationale is the person's own. */
  override: boolean;
  /** Shown in place of "drafted by the agent" while overriding. */
  overrideNote?: string;
  downstream: DownstreamEffect[];
}

/**
 * A whole claim's worth of attribution — who pays for each of the four lines.
 *
 * Named, because it is no longer only a property of a preset. The three liability
 * options each carry one as their starting point, and the reviewer edits from
 * there: the recommendation IS a four-line split, so the honest control for it is
 * four lines, not three buttons. See `setLine`.
 */
export type Allocation = Record<ClaimLineKey, LineAllocation>;

/**
 * Move one line, and say who moved it.
 *
 * The `why` under a line is the agent's reasoning for putting it where it did; once
 * a person overrides that, quoting the agent's reason beside their choice would be
 * putting words in their mouth. So a hand-set line says so, and the rationale box
 * is where the real reason goes — which is exactly why editing forces it open.
 *
 * `to` takes a third value the payer type does not have: `goodwill` is the insurer
 * paying a line it does not owe, which is a different claim from the insurer
 * meeting one it does. It collapses to `provider` plus a flag, because that is what
 * the money does.
 */
export function setLine(
  allocation: Allocation,
  key: ClaimLineKey,
  to: Payer | "goodwill",
): Allocation {
  const next: LineAllocation =
    to === "goodwill"
      ? { to: "provider", why: "Goodwill — set by reviewer", goodwill: true }
      : { to, why: "Set by reviewer" };
  return { ...allocation, [key]: next };
}

/** Whether an allocation still matches the preset it started from. */
export function matchesPreset(allocation: Allocation, option: CoverageOption): boolean {
  return CLAIM_LINES.every((line) => {
    const a = allocation[line.key];
    const b = option.allocation[line.key];
    return a.to === b.to && Boolean(a.goodwill) === Boolean(b.goodwill);
  });
}

/** Where a decision above the limit — or any denial — goes for sign-off. */
export const CO_APPROVER = "L. Maxim, Head of Claims";

/**
 * The three positions, in the order the console offers them: the two departures
 * first, the recommendation last and nearest the submit button.
 */
export const COVERAGE_OPTIONS: CoverageOption[] = [
  {
    id: "deny",
    title: "Deny liability",
    blurb: "The claimant recovers nothing. A written reason is required.",
    action: "denial",
    doneTitle: "Liability denied",
    allocation: {
      parts: { to: "customer", why: "Not payable" },
      labour: { to: "customer", why: "Not payable" },
      travel: { to: "customer", why: "Not payable" },
      freight: { to: "customer", why: "Not payable" },
    },
    draft: "",
    override: true,
    overrideNote:
      "A denial requires a written reason the claimant will see. Please record it.",
    downstream: [
      { text: "Liability position written to the claim file", detail: "— denied" },
      { text: "No reserve raised", detail: "— £0" },
      { text: "Denial letter drafted — Head of Claims sign-off required", hold: true },
      { text: "Treatment authorisation held", hold: true },
      {
        text: "Litigation exposure flagged to Legal",
        detail: "— £312,000 YTD",
      },
      {
        text: "Decision written to the ledger",
        detail: "— override of the recommendation",
      },
    ],
  },
  {
    id: "full",
    title: "Admit liability in full",
    blurb:
      "Aldergate Personal Injury meets the claim with no contributory reduction.",
    action: "full admission",
    doneTitle: "Full liability admitted",
    allocation: {
      parts: { to: "provider", why: "Payable in full" },
      labour: { to: "provider", why: "Payable in full" },
      travel: { to: "provider", why: "Payable in full" },
      freight: { to: "provider", why: "Payable in full" },
    },
    draft: "",
    override: true,
    overrideNote:
      "Full admission waives the 25% contributory negligence finding. Please record why.",
    downstream: [
      { text: "Liability position written to the claim file", detail: "— admitted in full" },
      { text: "Reserve opened", detail: "— £16,272.50" },
      { text: `Routed to ${CO_APPROVER.split(",")[0]} for co-approval`, hold: true },
      { text: "Treatment authorisation held pending co-approval", hold: true },
      {
        text: "Recovery referral raised",
        detail: "— third-party insurer, REC-2025-0331",
      },
      {
        text: "Decision written to the ledger",
        detail: "— override of the recommendation",
      },
    ],
  },
  {
    id: "partial",
    title: "Admit in part + goodwill",
    blurb: "Splits the claim by contributory negligence.",
    recommended: true,
    action: "partial admission",
    doneTitle: "Partial liability admitted",
    allocation: {
      parts: { to: "provider", why: "Injury established on the medical evidence" },
      labour: { to: "customer", why: "Reduced by the contributory share" },
      travel: {
        to: "provider",
        why: "Goodwill — rehabilitation continues",
        goodwill: true,
      },
      freight: { to: "customer", why: "Treatment pending the updated records" },
    },
    draft:
      "Both contributions are established and neither is sole. The third-party vehicle pulled out of a " +
      "side road into the claimant's path, and both the police report and the accident circumstances " +
      "report put it at fault for the manoeuvre, so the injury itself is payable. The claimant was not " +
      "wearing a seatbelt at the moment of impact, which the treating clinician ties to part of the " +
      "cervical injury severity, so a 25% contributory reduction applies to general and special damages. " +
      "Care and rehabilitation costs are absorbed as goodwill so the return-to-work plan is not " +
      "interrupted. The updated medical records and the IME addendum are still outstanding, so the " +
      "quantum position is not final.",
    override: false,
    downstream: [
      {
        text: "Liability position written to the claim file",
        detail: "— admitted in part, with rationale",
      },
      { text: "Reserve opened", detail: "— £9,690.00" },
      { text: "Claimant notification drafted", detail: "— owner: Dana Ferris" },
      { text: "Treatment authorisation released", detail: "— rehabilitation proceeds" },
      {
        text: "Recovery referral raised",
        detail: "— third-party insurer, REC-2025-0331",
      },
      {
        text: "Decision written to the ledger",
        detail: "— proposed and decided agree",
      },
    ],
  },
];

/** The position the case plan arrived at — the console opens on it. */
export const RECOMMENDED_OPTION_ID: CoverageOptionId = "partial";

/**
 * How sure the agent is of that position, 0–100.
 *
 * Here rather than beside the signals, because it is a property of the
 * RECOMMENDATION and this is where the recommendation is named. The assessment
 * panel's readout reads both from here
 * (../_components/assessment-chat/recommendation-readout.tsx), so the number in
 * the chat and the "Recommended" tag on the option card in the console cannot end
 * up describing two different positions.
 *
 * **The console does not print it, and that is deliberate.** A confidence figure
 * on the option card would invite reading the split as 87% correct, when what the
 * card offers is a choice between three positions a person signs. In the panel it
 * is the agent characterising its own answer, which is a different claim.
 *
 * A single number with no band mapping: 87 draws as 87, and nothing changes colour
 * at a threshold, because no threshold has been defined. Inventing one here would
 * be the surface asserting where "low confidence" starts.
 */
export const RECOMMENDATION_CONFIDENCE = 87;

export function coverageOption(id: CoverageOptionId): CoverageOption {
  const option = COVERAGE_OPTIONS.find((o) => o.id === id);
  // Unreachable while `id` is the union: every member has an entry above.
  if (!option) throw new Error(`Unknown coverage option: ${id}`);
  return option;
}

/**
 * What one position costs each side.
 *
 * The single source for the attribution table's totals, the authority meter and
 * every figure the "on submit" list quotes — computed, so the console can never
 * show a split that doesn't add up to the claim.
 */
export function splitOf(allocation: Allocation): { provider: Usd; customer: Usd } {
  return CLAIM_LINES.reduce(
    (acc, line) => {
      const to = allocation[line.key].to;
      return to === "provider"
        ? { ...acc, provider: acc.provider + line.amount }
        : { ...acc, customer: acc.customer + line.amount };
    },
    { provider: 0, customer: 0 },
  );
}

/**
 * The same, for a preset that has not been edited.
 *
 * Kept as its own name because several call sites only ever ask about a preset —
 * the banner's headline split, for one — and threading an allocation through them
 * to compute a figure the option already implies would be ceremony.
 */
export function splitFor(option: CoverageOption): { provider: Usd; customer: Usd } {
  return splitOf(option.allocation);
}

/**
 * Whether this position needs a second signature.
 *
 * Two independent triggers, and the second is the one a limit check alone would
 * miss: a denial escalates at ANY value, because £0 to the claimant is still a
 * commitment made in the company's name.
 */
export function escalates(option: CoverageOption): boolean {
  return escalatesWith(option.id, option.allocation);
}

/**
 * The live version, for an allocation the reviewer may have edited.
 *
 * Still two triggers, and the id still matters on its own: a denial escalates at any
 * value, because £0 to the claimant is a commitment made in the company's name. Editing lines can push a position over the limit or pull it back
 * under, and the meter is expected to follow.
 */
export function escalatesWith(id: CoverageOptionId, allocation: Allocation): boolean {
  return id === "deny" || splitOf(allocation).provider > DECISION_LIMIT;
}

/**
 * THE OUTCOMES THAT ARE NOT A LIABILITY POSITION.
 *
 * The console offered three exits and all three were a liability decision, which
 * meant a reviewer whose honest answer was "not yet" had to pick one anyway. The
 * screen's own policy test says the quantum position is *not final because the
 * updated medical records and the IME addendum have not arrived* — and there was no
 * control anywhere that asked for them.
 *
 * These are that gap, as data: what each one does, and what it costs. **Every one of
 * them names its cost**, because the claimant has been off work fourteen weeks and an
 * action that quietly adds a week to that is the interface hiding the consequence —
 * which is the one thing the on-submit list exists to prevent for the liability
 * decisions.
 *
 * `downstream` is the same shape the liability options use, so the same list renders
 * for both and a non-decision reports its effects exactly as a decision does.
 */
export interface SecondaryAction {
  id: string;
  /** On the button. */
  label: string;
  /** The confirmed state's headline. */
  title: string;
  /** What it does and what it costs, in one sentence. */
  note: string;
  downstream: DownstreamEffect[];
}

export const SECONDARY_ACTIONS: SecondaryAction[] = [
  {
    id: "request-evidence",
    label: "Request evidence",
    title: "Evidence requested",
    note:
      "Asks the treating practice for the updated medical records that would settle " +
      "the quantum position. The claim stays open and the claimant stays off work.",
    downstream: [
      { text: "Request raised against CLAIM-5182", detail: "— updated medical records" },
      { text: "Liability decision paused", detail: "— clock stops at 2h 13m" },
      { text: "Treatment authorisation held", hold: true },
      { text: "Claimant remains off work", detail: "— 14 weeks, no return date", hold: true },
      { text: "Written to the ledger", detail: "— evidence gap named" },
    ],
  },
  {
    id: "ask-customer",
    label: "Ask the claimant",
    title: "Question sent to the claimant",
    note:
      "Puts the seatbelt finding to Joseph Thompson before a position is taken. " +
      "His answer may move the contributory share either way.",
    downstream: [
      { text: "Question drafted to Joseph Thompson", detail: "— owner: Dana Ferris" },
      { text: "Liability decision paused", detail: "— clock stops at 2h 13m" },
      { text: "Claimant remains off work", detail: "— 14 weeks, no return date", hold: true },
      { text: "Written to the ledger", detail: "— claimant consulted" },
    ],
  },
  {
    id: "escalate",
    label: "Escalate now",
    title: "Escalated without a position",
    note:
      "Hands the case to the Head of Claims undecided. Use it when the call is above " +
      "this desk rather than when it is merely difficult.",
    downstream: [
      { text: `Routed to ${CO_APPROVER.split(",")[0]}`, detail: "— no position taken", hold: true },
      { text: "Liability decision reassigned", detail: "— off Dana Ferris's queue" },
      { text: "Treatment authorisation held", hold: true },
      { text: "Written to the ledger", detail: "— escalated undecided" },
    ],
  },
  {
    id: "defer",
    label: "Defer 24h",
    title: "Deferred for 24 hours",
    note:
      "Buys a day. It costs a day: the rehabilitation plan slips and the litigation " +
      "exposure grows against a claim already £312,000 reserved this year.",
    downstream: [
      { text: "Decision rescheduled", detail: "— due 13:46 tomorrow" },
      { text: "Response deadline extended", detail: "— +24 hrs on a 4 hr target", hold: true },
      { text: "Claimant remains off work", detail: "— 15 weeks at the new due time", hold: true },
      { text: "Litigation exposure grows", detail: "— £312,000 YTD before this" },
      { text: "Written to the ledger", detail: "— deferred by the reviewer" },
    ],
  },
];

export function secondaryAction(id: string): SecondaryAction | null {
  return SECONDARY_ACTIONS.find((a) => a.id === id) ?? null;
}

/** Pounds sterling with pence, the only money format this console prints. */
export function usd(amount: Usd, withSymbol = true): string {
  const formatted = amount.toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return withSymbol ? `£${formatted}` : formatted;
}
