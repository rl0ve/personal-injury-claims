// How the demo dataset and the live tenant are combined.
//
// Pure functions, deliberately kept out of the hooks: which fields cross over
// from a live case to a demo one is the most consequential decision in this app
// Get it wrong and the screen quietly lies about a real case, so it is worth
// being able to read, and test, without a React tree around it.
//
// Two modes, and they are not variations of each other:
//   · merge:   live rows are the list; demo fills gaps Maestro does not carry
//   · overlay: demo rows are the list, wearing live ids, stages and links
// `useCases` picks between them; neither ever produces a row that is partly one
// case and partly another.

import { DEMO_ACTIONS, DEMO_CASES } from "./demoData";
import type { CaseAction, InjuryClaim } from "./types";

/** Live fields win; demo fields fill the gaps Maestro does not carry. */
export function mergeCase(demo: InjuryClaim, live: InjuryClaim): InjuryClaim {
  return {
    ...demo,
    ...live,
    customer: live.customer || demo.customer,
    site: live.site || demo.site,
    description: live.description || demo.description,
    owner: live.owner || demo.owner,
    ownerRole: live.ownerRole || demo.ownerRole,
    claimValue: live.claimValue || demo.claimValue,
    asset: {
      model: live.asset.model || demo.asset.model,
      serial: live.asset.serial || demo.asset.serial,
      description: live.asset.description || demo.asset.description,
      inServiceMonths: live.asset.inServiceMonths || demo.asset.inServiceMonths,
      coverageStatus: live.asset.coverageStatus || demo.asset.coverageStatus,
    },
    evidence: live.evidence.length ? live.evidence : demo.evidence,
    trail: live.trail.length ? live.trail : demo.trail,
    variables: { ...demo.variables, ...live.variables },
    isLive: true,
  };
}

/**
 * Live instances, with the demo row of the same id filling gaps Maestro does
 * not carry. Demo rows with no live counterpart are NOT appended: once the app
 * is reading a real case, padding the queue with fictional rows would make the
 * counts lie. Callers decide when to show the demo set instead, never blended.
 */
export function mergeCases(live: InjuryClaim[]): InjuryClaim[] {
  const byId = new Map(DEMO_CASES.map((c) => [c.id, c]));
  return live.map((liveCase) => {
    const demo = byId.get(liveCase.id);
    return demo ? mergeCase(demo, liveCase) : liveCase;
  });
}

/** The claim the demo script names out loud. */
const HERO_CASE_ID = "CLAIM-5182";

// ── Overlay ─────────────────────────────────────────────────────────────────

/**
 * The demo case wearing a live instance's identity and progress.
 *
 * Deliberately narrow. Only four things cross over, because only four things
 * are better coming from the tenant than from the script:
 *   · the id, so the row is the real case and its route is the real route
 *   · the links, instance and folder, so "Open case run" opens the run
 *   · stage state, so the board shows where the process actually got to,
 *     except `status`, which the queue counts on; see below
 *   · liveness, so everything downstream treats it as real
 *
 * Everything the story rests on (claimant, injury, evidence, claim value, the
 * SLA clocks, the variables) stays demo, because the tenant either does not
 * carry it or carries a placeholder, and a half-populated hero card is worse
 * than a scripted one.
 *
 * Stage states merge rather than replace: live wins on every stage it mentions,
 * and demo stages the live plan says nothing about survive. A live plan that
 * matches the demo one therefore takes over completely, and one that diverges
 * degrades to showing what it does know instead of blanking the board.
 */
export function overlayCase(demo: InjuryClaim, live: InjuryClaim): InjuryClaim {
  return {
    ...demo,
    // Business id stays the demo one: the script names CLAIM-5182 out loud, and
    // a Maestro instance id in that column reads as a bug on a projector. The
    // real instance travels in instanceId, which is what the links use.
    id: demo.id,
    instanceId: live.instanceId,
    folderKey: live.folderKey,
    currentStage: live.currentStage || demo.currentStage,
    activeLanes: live.activeLanes.length ? live.activeLanes : demo.activeLanes,
    stageStates: Object.keys(live.stageStates).length
      ? { ...demo.stageStates, ...live.stageStates }
      : demo.stageStates,
    lastUpdatedAt: live.lastUpdatedAt || demo.lastUpdatedAt,

    // Restated from the demo, on purpose, unlike the rest of the stage state.
    //
    // `status` is not really a stage fact. It is what the queue sorts and
    // counts on, and this screen's whole claim is three cases needing a person
    // out of forty-one open. A rehearsal instance sitting in Progressing would
    // quietly empty that, leaving the app telling the truth about an instance
    // nobody came to see instead of the story everybody did. Turn the overlay
    // off to see what the tenant says its cases are doing.
    status: demo.status,
    isLive: true,
    overlaidFrom: demo.id,
  };
}

/**
 * Demo cases with live instances painted over them.
 *
 * Paired by position, not by id: a Maestro instance id has no relationship to a
 * demo business id, so there is nothing to match on. **Newest instance first**,
 * which is the demo's own working order: the run started minutes before the
 * keynote is the one that should be Dana Ferris's case, and starting another from
 * "New case" makes that new one the hero in turn.
 *
 * The queue stays exactly the demo set. Instances past the last demo case are
 * not appended: this screen's claim is three cases needing a person out of
 * forty-one open, and a tenant carrying a dozen rehearsal runs would bury it.
 * Turning the overlay off is how you see everything the tenant actually holds.
 *
 * Demo cases past the end of the live set stay demo, so the queue still tells
 * the story when the tenant has one instance in it, or none.
 */
export function overlayCases(live: InjuryClaim[]): InjuryClaim[] {
  const newest = [...live].sort(
    (a, b) => Date.parse(b.openedAt || "") - Date.parse(a.openedAt || ""),
  )[0];
  if (!newest) return DEMO_CASES;

  // Exactly one case is live, and it is always the hero.
  //
  // This used to attach every instance it could find, one per demo row in
  // order, so a tenant carrying three rehearsal runs lit up three cases. That
  // reads as three real claims when there is one, and it moves with whatever
  // happens to be running rather than staying where the script points. One
  // instance, on CLAIM-5182, and every other row is honestly the storyboard.
  const overlaid = DEMO_CASES.map((demo) =>
    demo.id === HERO_CASE_ID ? overlayCase(demo, newest) : demo,
  );

  // The live one leads the queue. Everything downstream reads the first row as
  // the case in play, and a real run sitting third is the one thing on this
  // screen a viewer cannot be expected to find on their own.
  return [
    ...overlaid.filter((c) => c.isLive),
    ...overlaid.filter((c) => !c.isLive),
  ];
}

/**
 * A demo action's case id, translated to whatever its case is called now.
 *
 * Demo actions name their case by its demo id. Under the overlay that case is
 * wearing a live id, and an action still pointing at the old one belongs to no
 * case at all. It disappears from the detail page and the queue.
 */
export function overlayActions(cases: InjuryClaim[], live: CaseAction[]): CaseAction[] {
  const renamed = new Map<string, string>();
  for (const c of cases) if (c.overlaidFrom) renamed.set(c.overlaidFrom, c.id);

  const spine = DEMO_ACTIONS.map((demo) => {
    const caseId = renamed.get(demo.caseId);
    return caseId ? { ...demo, caseId } : demo;
  });

  // Live tasks land on the demo action for the same case and action type,
  // `actionType` being the Action App's own dispatch code, which is the only
  // thing the two sides genuinely share. The live task brings its id, so
  // completing the decision completes the real task rather than a fiction.
  //
  // Deduped first. The Case Manager can start the same task twice — a retry, or
  // two invocations racing on the same rules gap — and Orchestrator then holds
  // two open tasks that are the same piece of work. Showing both reads as a
  // bug. Newest wins.
  //
  // Status is part of the key, and has to be. Action Center usually sends no
  // dispatch code, so `actionType` is `""` and every task on a case collides on
  // one key — which meant a completed submission lost to whatever open task the
  // agent started next, because `elapsedMinutes` saturates at the SLA and an
  // older task always sorts last. Dana submitted, came back to the case, and
  // found no sign of it. A finished task and an open one are never the same
  // piece of work, so they never share a key.
  const seen = new Set<string>();
  const deduped = [...live]
    // Least elapsed first: of two tasks for the same work, the newer one is the
    // one the agent started most recently, and the stale twin is the leftover.
    .sort((a, b) => (a.elapsedMinutes ?? 0) - (b.elapsedMinutes ?? 0))
    .filter((a) => {
      const key = `${a.caseId}::${a.actionType}::${a.status}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

  // A live case shows only its real tasks, and shows none when it has none.
  //
  // The earlier version kept demo actions whenever a case had no live task yet,
  // which put "Liability and quantum: new medical information" on a case whose
  // instance was still in Claim Intake — an action for a step the run had not
  // reached, offering to complete a task that did not exist. Being attached to
  // a real instance is the whole claim this row makes; inventing work on top of
  // it breaks that. Cases with no instance behind them are storyboard rows and
  // keep their demo actions, because there the script is all there is.
  const liveCaseIds = new Set(cases.filter((c) => c.isLive).map((c) => c.id));

  const used = new Set<CaseAction>();
  const result = spine.map((demo) => {
    const match =
      deduped.find(
        (a) => !used.has(a) && a.caseId === demo.caseId && a.actionType === demo.actionType,
      ) ??
      // No actionType match: still dress the live task in this case's demo copy
      // rather than letting it render bare. Action Center carries a task title
      // and nothing else — no argument, no stage, no reason it reached anyone —
      // so an undressed row is a title and two buttons.
      deduped.find((a) => !used.has(a) && a.caseId === demo.caseId);
    if (!match) return liveCaseIds.has(demo.caseId) ? null : demo;
    used.add(match);
    return mergeAction(demo, match);
  });

  const dressed = result.filter((a): a is CaseAction => a !== null);

  // Anything left over has no demo action to borrow from at all.
  return [...dressed, ...deduped.filter((a) => !used.has(a))];
}


/**
 * Live fields win; the demo action supplies the argument Action Center does not
 * carry: the causes, the cost lines, the authority limit, the recommendation.
 * Matched on `actionType`, which is the Action App's own dispatch code.
 */
export function mergeAction(demo: CaseAction, live: CaseAction): CaseAction {
  return {
    ...demo,
    ...live,
    // Presentation comes from the demo action, identity from the live one.
    // Action Center's title is the case plan's task name and there is nothing
    // behind it; the demo action is where the claim, the argument and the
    // reason this reached a person are written. Reading the live title here
    // turned a full card into "Confirm the coverage position on this claim".
    title: demo.title || live.title,
    stage: demo.stage || live.stage,
    assignee: demo.assignee || live.assignee,
    whyThisReachedYou: demo.whyThisReachedYou || live.whyThisReachedYou,
    options: live.options.length && !demo.options.length ? live.options : demo.options,
    recommendation: live.recommendation.headline ? live.recommendation : demo.recommendation,

    // The rich console's argument, restated rather than left to the spread.
    // A spread overwrites with `undefined` when the key is merely present, and
    // `causes` is the switch the console reads to decide which form to render,
    // so a live task that happens to carry the key would silently demote the
    // combined-cause screen to the plain one. Live still wins when it has
    // something; the difference is that absence no longer counts as a value.
    causes: live.causes?.length ? live.causes : demo.causes,
    verdict: live.verdict ?? demo.verdict,
    costLines: live.costLines?.length ? live.costLines : demo.costLines,
    authority: live.authority ?? demo.authority,
    folds: live.folds?.length ? live.folds : demo.folds,
    effects: live.effects?.length ? live.effects : demo.effects,
    tiles: live.tiles?.length ? live.tiles : demo.tiles,
    claimTotal: live.claimTotal ?? demo.claimTotal,
    claimLineSummary: live.claimLineSummary || demo.claimLineSummary,
    confidencePercent: live.confidencePercent ?? demo.confidencePercent,
    precedent: live.precedent || demo.precedent,
    peerContext: live.peerContext || demo.peerContext,
    draftRationale: live.draftRationale || demo.draftRationale,
  };
}

