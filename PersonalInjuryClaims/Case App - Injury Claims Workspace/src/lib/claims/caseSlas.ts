// Every clock on a case, at all three levels.
//
// A claim carries more than one SLA at once: the case clock (4 d, or the
// 24 h P1 override from SDD §1), a clock per stage it has entered, and a clock
// per open human task. The SLAs tab shows all of them; the Overview widget shows
// the case clock plus whatever needs attention. Both read this one function, so a
// pill in the list can never contradict a countdown in the console.

import { ALL_STAGES, findStage, PRIMARY_STAGES } from "./casePlan";
import { slaStatusFor } from "./sla";
import type { CaseAction, CaseSlaEntry, SlaStatus, InjuryClaim } from "./types";

const MINUTE = 60_000;

/**
 * SDD §1 variable SLA rule: `vars.priority === "P1"` ⇒ 24 h, else 4 d. The case
 * row carries its own `slaMinutes` for the stage it is in, so the case clock is
 * derived here rather than stored, and stays right when priority changes.
 */
export function caseSlaMinutes(claim: InjuryClaim): number {
  return claim.priority === "P1" ? 24 * 60 : 4 * 24 * 60;
}

export function caseSlaLabel(claim: InjuryClaim): string {
  return claim.priority === "P1"
    ? "Personal Injury Claims Resolution P1 Case SLA"
    : "Personal Injury Claims Resolution Case SLA";
}

/**
 * Minutes the case has been open, measured from `openedAt`.
 *
 * Demo rows anchor their timestamps to module load (see `DEMO_NOW`), so this is
 * the same measurement for a demo case and a live one, with no special case needed,
 * and a demo left on the shelf does not age out of step with the per-stage
 * figures stored on the row.
 */
function caseElapsedMinutes(claim: InjuryClaim, now: number): number {
  const opened = Date.parse(claim.openedAt);
  if (Number.isNaN(opened)) return claim.elapsedMinutes;
  return Math.max(0, Math.round((now - opened) / MINUTE));
}

function dueFrom(now: number, elapsedMinutes: number, budgetMinutes: number): Date {
  return new Date(now + (budgetMinutes - elapsedMinutes) * MINUTE);
}

/**
 * A P1 claim whose claimant is still without urgent treatment is at risk on the
 * clock it is currently running, however much of that clock is left.
 *
 * Burn percentage is the wrong measure here. A severe-injury claim can have
 * used 107 of 240 minutes, 45% and comfortably "On track" by the ordinary
 * threshold, while the claimant has been waiting for treatment for 96 hours.
 * The clock is not at risk because it is nearly spent; it is at risk because
 * the thing it exists to protect is already failing.
 *
 * Deliberately narrow. It escalates one entry, the stage the case is actually
 * in, rather than every clock on the case: a P1 with an untreated claimant
 * would otherwise light up its case clock, its stage clock and its task clock
 * with three copies of one fact, which is noise rather than signal. It never
 * escalates past At risk, because whether a clock has *breached* is a question
 * about that clock and nothing else.
 */
function escalateWhileLineDown(
  claim: InjuryClaim,
  status: SlaStatus,
): SlaStatus {
  if (status !== "On track") return status;
  if (claim.priority !== "P1") return status;
  // "Untreated · awaiting care" and the like. A claimant already in treatment does not count.
  if (!/^(unfit for work|untreated|awaiting treatment)\b/i.test(claim.lineStatus ?? "")) {
    return status;
  }
  return "At risk";
}

/**
 * All clocks on the case, most urgent first within each level.
 *
 * A stage that has not been entered yet contributes a "Not triggered" row rather
 * than being omitted: the SLAs tab is where someone asks "what clocks exist on
 * this case", and the answer includes the ones that have not started.
 */
export function getCaseSlas(
  claim: InjuryClaim,
  actions: CaseAction[],
  now: number = Date.now(),
): CaseSlaEntry[] {
  const entries: CaseSlaEntry[] = [];

  // ── Case level ────────────────────────────────────────────────────────────
  const caseBudget = caseSlaMinutes(claim);
  const caseElapsed = caseElapsedMinutes(claim, now);
  entries.push({
    id: "case",
    level: "case",
    label: caseSlaLabel(claim),
    dueAt: dueFrom(now, caseElapsed, caseBudget),
    status:
      claim.status === "Closed"
        ? "Met"
        : slaStatusFor(caseElapsed, caseBudget),
    condition:
      claim.priority === "P1"
        ? "priority is P1, on the 24-hour urgent-care clock"
        : "the case is opened",
  });

  // ── Stage level ───────────────────────────────────────────────────────────
  // Primary stages always appear; a conditional lane only once it is open, since
  // a dormant lane has no clock to report.
  const laneStages = claim.activeLanes
    .map(findStage)
    .filter((s): s is NonNullable<typeof s> => Boolean(s));

  for (const stage of [...PRIMARY_STAGES, ...laneStages]) {
    const state = claim.stageStates[stage.id] ?? "pending";

    if (stage.slaMinutes == null) {
      entries.push({
        id: `stage:${stage.id}`,
        level: "stage",
        label: `${stage.name} SLA`,
        dueAt: new Date(now),
        status: "Not triggered",
        condition: `${stage.sla.toLowerCase()}, no clock configured`,
      });
      continue;
    }

    let status: SlaStatus;
    let elapsed = 0;
    if (state === "completed") {
      status = "Met";
    } else if (state === "skipped" || state === "pending") {
      status = "Not triggered";
    } else {
      // The case row carries an elapsed figure for the stage it is in. A stage
      // running in parallel (liability and medical evidence do, per BR-002) has no
      // entry timestamp on the row, so it is measured from the case clock.
      //
      // That over-states a parallel stage's age by however long intake took, and
      // it is deliberately NOT clamped to the budget: clamping would park every
      // long-running parallel stage at exactly 100% and report a breach that is
      // an artefact of the clamp rather than of the case. A live instance
      // replaces this with real stage entry times.
      const current = stage.name === claim.currentStage;
      elapsed = current ? claim.elapsedMinutes : caseElapsed;
      status = slaStatusFor(elapsed, stage.slaMinutes);
      if (current) status = escalateWhileLineDown(claim, status);
    }

    entries.push({
      id: `stage:${stage.id}`,
      level: "stage",
      label: `${stage.name} SLA`,
      dueAt: dueFrom(now, elapsed, stage.slaMinutes),
      status,
      condition:
        state === "pending"
          ? `${stage.name} is entered`
          : state === "skipped"
            ? "the stage was bypassed"
            : // Says why it is at risk when the burn alone would not explain it.
              status === "At risk" && slaStatusFor(elapsed, stage.slaMinutes) === "On track"
              ? `the claimant has been awaiting treatment for ${claim.lineDownHours ?? 0} hours on a P1 claim`
              : `${stage.name} was entered`,
    });
  }

  // ── Action level ──────────────────────────────────────────────────────────
  //
  // A task clock that falls on the same minute as the stage it belongs to is
  // that stage's clock under another name. The stage is blocked on the task,
  // both run the same budget from the same start, and listing both puts one
  // commitment on the screen twice. Worse, the two can disagree: a P1 stage
  // escalated by an untreated claimant would sit beside its own task reporting "On track"
  // with an identical countdown, which reads as a bug rather than as nuance.
  const currentStageEntry = entries.find(
    (e) => e.level === "stage" && e.label === `${claim.currentStage} SLA`,
  );

  for (const action of actions) {
    const dueAt = dueFrom(now, action.elapsedMinutes, action.slaMinutes);
    const duplicatesStage =
      action.status !== "Completed" &&
      currentStageEntry != null &&
      action.stage === claim.currentStage &&
      Math.abs(dueAt.getTime() - currentStageEntry.dueAt.getTime()) < MINUTE;
    if (duplicatesStage) continue;

    entries.push({
      id: `action:${action.id}`,
      level: "action",
      label: `${action.title} task SLA`,
      dueAt,
      status:
        action.status === "Completed"
          ? "Met"
          : slaStatusFor(action.elapsedMinutes, action.slaMinutes),
      condition: `${action.stage} raised the task`,
    });
  }

  return entries;
}

/** Stage rows for one stage id, so the Stages tab can show its clock inline. */
export function stageSla(
  claim: InjuryClaim,
  stageId: string,
  actions: CaseAction[],
  now: number = Date.now(),
): CaseSlaEntry | undefined {
  return getCaseSlas(claim, actions, now).find((s) => s.id === `stage:${stageId}`);
}

/** Owner group for a stage, from the case plan. */
export function stageOwner(stageId: string): string {
  return ALL_STAGES.find((s) => s.id === stageId)?.owner ?? "Unassigned";
}
