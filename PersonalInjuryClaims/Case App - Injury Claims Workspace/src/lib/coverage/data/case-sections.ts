import { CASE_DOCUMENTS, type CaseDocument } from "./case-documents";
import { DECISION_SIGNALS, type DecisionSignal } from "./decision-signals";
import { PRECEDENT, type Precedent } from "./precedent";

/**
 * THE DECISION PAGE'S SECTIONS, PER CASE.
 *
 * The claims console's decision page grew three sections — Historical data,
 * Evidence and Documents — out of the assessment widget's three rollups, and the
 * move surfaced a problem the widget never had. The widget is one panel beside
 * three views of ONE case, so reading module data was honest: whichever view was
 * up, it was CLAIM-5182 and those were its signals. The decision page is a route
 * with a case id in it. Rendering the same three modules there would have put
 * CLAIM-5182's evidence, base rate and documents on CLAIM-5164's decision and
 * called them its own.
 *
 * So this is the indirection: three lookups, keyed by case.
 *
 * ## Real for one case, mock for the rest, and said out loud
 *
 * CLAIM-5182 returns the authored fixtures unchanged — it is the case the demo
 * is about, the road traffic accident where contributory negligence reduces the
 * settlement. The other decision in the dataset gets its own smaller set, written
 * to be coherent with what that case is about rather than generated: a condition
 * deterioration exception argues a different thing from a combined cause, and
 * filler with the right shape and the wrong words is worse than nothing on a
 * screen someone is going to project.
 *
 * It is deliberately SHORTER than 5182's. A demo has one case it dwells on,
 * and a supporting case that matched it fact for fact would invite the question of
 * why the tour did not use that one instead.
 *
 * ## Why the lookups live here and not on the case
 *
 * Everything else this page draws hangs off the app's own objects —
 * `action.folds`, `claim.standing`. These three do not, and that is on
 * purpose: their content is authored in this folder (`./decision-signals.ts`,
 * `./precedent.ts`, `./case-documents.ts`), which is cartographer's, and the
 * embedded app's data layer is upstream's. Threading them onto `CaseAction` would
 * mean extending upstream's types and demo fixtures to carry this repo's content,
 * on files upstream actively edits. The seam already runs this way — the console
 * imports `EVIDENCE_ANCHORS` and the stance context across it — and it runs one
 * way only.
 *
 * ## Anchors on the mock signals
 *
 * The mock set points only at anchors that case actually declares. Its actions
 * carry no `causes` and no `folds`, so the finding's anchors are not in its DOM
 * and a signal claiming `causeDefect` would scroll to nothing. It uses `verdict`
 * where the action has a verdict line and otherwise declares no anchor at all,
 * which the spotlight reads as "nothing to point at" rather than as an error
 * (./anchor-sections.ts says why absence is a normal answer).
 *
 * **Authored and pure.** No clock, no counters, no reader state — the Signal
 * Collector is prerendered, and a value that differed between build and hydration
 * would be a mismatch.
 */

/** The case the demo is about. Everything else here is scaffolding around it. */
export const DEMO_CASE_ID = "CLAIM-5182";

// ── CLAIM-5164 · medical exception requested ─────────────────────────────────

const SIGNALS_5164: DecisionSignal[] = [
  {
    id: "sig-0409-outside-envelope",
    importance: "high",
    short: "Treatment above the standard care guideline",
    headline: "The proposed treatment package exceeds the standard care guideline",
    description:
      "The treating consultant's proposed package adds an extended course of " +
      "specialist rehabilitation not on the standard care guideline for this " +
      "injury band. That is not the claimant's doing — the condition genuinely " +
      "deteriorated after the first review — but it means the standard quantum " +
      "check does not answer the question, and an independent medical view of " +
      "the exception is what is being asked for.",
    backs: "Exception, not a liability call",
    sources: ["Injury Severity Data Gateway", "Provider Network Gateway"],
    anchors: [],
  },
  {
    id: "sig-0409-spec-mismatch",
    importance: "medium",
    short: "Impairment rating above the initial band",
    headline: "The revised impairment rating exceeds the band the claim was reserved at",
    description:
      "The consultant's revised rating sits well above the band the claim was " +
      "first reserved at. Independent Medical Examination owns whether that is " +
      "carried as a re-banded quantum or a reserve uplift held pending the IME " +
      "addendum, and neither answer is a liability decision — which is precisely " +
      "why this one does not resolve itself.",
    backs: "Independent Medical Examination owns the outcome",
    sources: ["Injury Severity Data Gateway", "Provider Network Gateway"],
    anchors: [],
  },
];

const PRECEDENT_5164: Precedent = {
  window: "Last 18 months",
  criteria: "soft-tissue injury, treatment above standard guideline",
  shares: [
    { option: "partial", cases: 6 },
    { option: "full", cases: 5 },
    { option: "deny", cases: 0 },
  ],
};

const DOCUMENTS_5164: CaseDocument[] = [
  {
    id: "doc-0409-scope",
    title: "Hospital discharge summary",
    issuer: "Provider Network Gateway",
    pages: 2,
    href: CASE_DOCUMENTS[2].href,
    readOff: "Extended rehabilitation course proposed, above the standard care guideline.",
  },
  {
    id: "doc-0409-policy",
    title: "Policy schedule extract",
    issuer: "Aldergate Personal Injury",
    pages: 2,
    href: CASE_DOCUMENTS[1].href,
    readOff: "Motor Third Party Injury, active to 2027-01-11.",
  },
  {
    id: "doc-0409-sop",
    title: "Personal Injury Claims SOP v3",
    issuer: "Aldergate Personal Injury",
    pages: 3,
    href: CASE_DOCUMENTS[CASE_DOCUMENTS.length - 1].href,
    readOff: null,
  },
];

// ── The lookups ──────────────────────────────────────────────────────────────

/**
 * Every case with sections of its own.
 *
 * A map rather than a switch so the three lookups below cannot disagree about
 * which cases are covered — adding a case is one entry, not three.
 */
const BY_CASE: Record<
  string,
  { signals: DecisionSignal[]; precedent: Precedent; documents: CaseDocument[] }
> = {
  [DEMO_CASE_ID]: {
    signals: DECISION_SIGNALS,
    precedent: PRECEDENT,
    documents: CASE_DOCUMENTS,
  },
  "CLAIM-5164": {
    signals: SIGNALS_5164,
    precedent: PRECEDENT_5164,
    documents: DOCUMENTS_5164,
  },
};

/**
 * The evidence behind a case's recommendation.
 *
 * An unknown case gets an EMPTY list, not the demo case's. The three sections
 * render nothing when their data is empty, which is the honest outcome for one of
 * the 38 generated background cases: they have no authored decision and inventing
 * one would put five paragraphs of argument under a case that has none. Those
 * cases carry no action either, so the page is not reachable for them today — this
 * is the answer for when one does.
 */
export function signalsForCase(caseId: string): DecisionSignal[] {
  return BY_CASE[caseId]?.signals ?? [];
}

/** How comparable claims went. `null` where the case has no authored base rate. */
export function precedentForCase(caseId: string): Precedent | null {
  return BY_CASE[caseId]?.precedent ?? null;
}

/** The papers the reading was taken from. Empty where there are none. */
export function documentsForCase(caseId: string): CaseDocument[] {
  return BY_CASE[caseId]?.documents ?? [];
}

/**
 * How many signals sit at each rank, for one case.
 *
 * The same derivation `signalTally` does in ./decision-signals.ts, taking the
 * case's own list — so a section header's "3 high" counts the signals actually
 * below it rather than the demo case's.
 */
export function signalTallyFor(signals: DecisionSignal[]): {
  high: number;
  medium: number;
  low: number;
} {
  return signals.reduce(
    (acc, s) => ({ ...acc, [s.importance]: acc[s.importance] + 1 }),
    { high: 0, medium: 0, low: 0 },
  );
}
