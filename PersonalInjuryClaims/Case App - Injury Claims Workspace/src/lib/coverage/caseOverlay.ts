import type { CaseAction, DecisionEffect, InjuryClaim } from "@/lib/claims/types";

/**
 * THE CI SCREEN'S OWN NUMBERS, applied at the page boundary and nowhere else.
 *
 * The screen came from a fork that re-authored the claim. Its `fixture.ts` says
 * where the split is: the evidence, the recommendation and the claim history are
 * authored there, and "the money and the policy dates are NOT here — they come
 * off the case and the action", which in the fork meant its own copy of
 * ../claims/demoData.ts. That copy carries a £109,950 claim over six smaller
 * lines, a £25,000 signing ceiling and a £780/yr policy renewing 2026-11-02.
 *
 * This app's demo set carries the original £219,900 claim, and the work queue,
 * the case page, the task queue and the performance tiles all print from it. So
 * the fork's figures are applied HERE, to a shallow copy, by the CI page only
 * (../../pages/cases/CoverageDecisionCiPage.tsx). Everything downstream — the
 * store, the record sections, the submit bar — reads the overlaid objects and is
 * unmodified from the fork, and every other screen reads `demoData` untouched.
 *
 * THE ALTERNATIVE WAS PORTING THE FORK'S `demoData` WHOLE, and it would have
 * moved the claim amount everywhere. The flag is meant to change one screen.
 *
 * Keyed to CLAIM-5182, the one case `coverageFixtureFor` authors, and a
 * pass-through for anything else — so this stays inert if the page is ever
 * reached with the flag on and a different case in the URL.
 */

const CASE_ID = "CLAIM-5182";

/**
 * The effect lists differ from this app's in three strings and nothing else: two
 * reserve figures that follow from the smaller claim, and the approver, who
 * is the one named by the £25,000 ceiling.
 *
 * A substitution rather than four re-authored `effects` arrays (denied, approved,
 * partial, and the action's own). Those arrays are twenty-four rows between them
 * and only these three spans move, so copying them out would be twenty-one rows
 * of duplicate that a later edit upstream would silently desynchronise.
 */
const EFFECT_SUBSTITUTIONS: [string, string][] = [
  // The full claim, on Approve.
  ["£219,900.00", "£109,950.00"],
  // The assessed portion payable to the claimant, on the recommended partial.
  ["£168,900.00", "£84,450.00"],
  ["D. Whitfield-Nkemelu", "L. Maxim"],
];

function overlayEffects(effects: DecisionEffect[] | undefined): DecisionEffect[] | undefined {
  if (!effects) return effects;
  return effects.map((e) => {
    let detail = e.detail;
    let title = e.title;
    for (const [from, to] of EFFECT_SUBSTITUTIONS) {
      if (detail) detail = detail.split(from).join(to);
      title = title.split(from).join(to);
    }
    return detail === e.detail && title === e.title ? e : { ...e, title, detail };
  });
}

/**
 * The action, with the fork's claim, finding and ceiling on it.
 *
 * `options` keeps its allocations untouched — those are identical in both copies,
 * and they are what `splitFor` reads, so the recommended partial still resolves
 * to the assessed portions payable. Only the effect strings inside each option
 * move, for the reason above.
 *
 * Absent here and deliberately so: `folds` and `tiles`. The fork deleted four of
 * the six folds and dropped the tiles, and the CI screen renders neither — the
 * record's own sections replaced them. Overlaying data nothing reads would be
 * inventing a contract.
 */
export function ciActionOverlay(action: CaseAction): CaseAction {
  if (action.caseId !== CASE_ID) return action;

  return {
    ...action,
    title: "Liability and quantum position — contributory negligence applied",
    whyThisReachedYou:
      "The third-party insurer disputes liability, and the claimant's own share of the accident is agreed only in part. Liability is admitted subject to a 25% contributory negligence reduction on general and special damages. Updated medical information is still outstanding, so no rule decides how much of the claim that reaches.",
    claimTotal: 109_950,
    claimLineSummary: "6 lines · general damages, special damages, care and rehabilitation, medical",
    costLines: [
      { id: "buildings-covered", name: "General damages — assessed portion", amount: 67_500 },
      { id: "buildings-shortfall", name: "General damages — contributory negligence reduction", amount: 22_500 },
      { id: "contents-covered", name: "Special damages — assessed portion", amount: 9_000 },
      { id: "contents-shortfall", name: "Special damages — contributory negligence reduction", amount: 3_000 },
      { id: "ale", name: "Care and rehabilitation costs", amount: 4_900 },
      { id: "debris", name: "Medical and treatment costs", amount: 3_050 },
    ],
    authority: {
      limit: 25_000,
      approver: "L. Maxim, Head of Claims",
    },
    // One line each, and each answers only "which side, and on what ground". The
    // evidence for the ground is the second sentence of `body`, one press away;
    // printing it on the closed line made the summary argue the case rather than
    // name it.
    causes: [
      {
        side: "covered",
        label: "Cause 1",
        title: "Road traffic accident, liability admitted in part",
        body:
          "The third-party vehicle pulled out of a side road into Joseph Thompson's path, causing a cervical soft-tissue injury and a fractured left wrist. The police report and the accident circumstances report both put the third party at fault for the manoeuvre. Liability is admitted in part.",
        summary: "Third party at fault for the manoeuvre — liability admitted in part",
        points: "Points to covered",
        established: "09-01, accident circumstances report",
        sources: ["Injury Severity Data Gateway", "Injury Claims Gateway"],
      },
      {
        side: "excluded",
        label: "Cause 2",
        title: "Contributory negligence, seatbelt not worn",
        body:
          "The claimant was not wearing a seatbelt at the moment of impact, which the treating clinician's notes tie directly to the severity of the cervical injury. The third-party insurer puts the claimant's share at 25%; general and special damages are reduced in the same proportion.",
        summary: "25% contributory negligence — that share not payable",
        points: "Points to excluded",
        established: "assessed 09-01",
        sources: ["Injury Severity Data Gateway", "Injury Policy Gateway"],
      },
    ],
    // ONE SENTENCE ACROSS THE TWO FIELDS, and the comma is load-bearing: the note
    // renders `headline` bold and `detail` in secondary ink on the same line.
    verdict: {
      headline: "The 25% reduction applies to general and special damages only,",
      detail: "as care, rehabilitation and treatment costs are met in full under the policy.",
    },
    effects: overlayEffects(action.effects),
    options: action.options.map((o) => ({ ...o, effects: overlayEffects(o.effects) })),
  };
}

/**
 * The case, with the claim and the policy the fork's screen prints.
 *
 * `standing` is optional on the type and the section folds itself away without
 * it, so this leaves a case that has none alone rather than inventing one.
 */
export function ciCaseOverlay(claim: InjuryClaim): InjuryClaim {
  if (claim.id !== CASE_ID) return claim;

  return {
    ...claim,
    claimValue: 109_950,
    description: "Liability disputed — contributory negligence applied, medical evidence outstanding",
    asset: {
      ...claim.asset,
      coverageStatus: "Motor Third Party Injury ALD-PI-2023-5182 · active to 2026-11-02 · £500 excess",
    },
    standing: claim.standing
      ? {
          ...claim.standing,
          annualValue: 780,
          renewalDate: "2026-11-02",
        }
      : claim.standing,
  };
}
