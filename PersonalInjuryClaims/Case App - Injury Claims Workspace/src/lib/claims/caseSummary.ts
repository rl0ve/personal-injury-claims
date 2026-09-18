import { PRIMARY_STAGES } from "./casePlan";
import { relativeTime } from "./format";
import { formatRemaining } from "./sla";
import type { InjuryClaim } from "./types";

// The case agent's account of where the case has got to.
//
// Deliberately about *progress*, not about what is owed: the Action needed card
// sitting beside it already states the open decision and why it landed on a
// person, and the two were saying the same thing twice. This one answers the
// question you ask before picking the work up, which is what has happened so
// far and what is left.

function stageCounts(claim: InjuryClaim) {
  const done = PRIMARY_STAGES.filter(
    (s) => claim.stageStates[s.id] === "completed",
  ).length;
  const index = PRIMARY_STAGES.findIndex((s) => s.name === claim.currentStage);
  const remaining = index >= 0 ? PRIMARY_STAGES.slice(index + 1) : [];
  return { done, total: PRIMARY_STAGES.length, remaining };
}

// Stage names are joined with commas and never with "and", because half of them
// contain one: "Medical Evidence and Treatment and Rehabilitation and
// Return-to-Work are closed" is a sentence nobody can parse. They also keep their own
// capitalisation, since they are names rather than descriptions.

/** What is behind the case. */
function behind(claim: InjuryClaim): string {
  const closed = PRIMARY_STAGES.filter(
    (s) => claim.stageStates[s.id] === "completed",
  ).map((s) => s.name);
  if (closed.length === 0) return "";
  return `Closed so far: ${closed.join(", ")}.`;
}

/** What is still ahead of it. */
function ahead(claim: InjuryClaim): string {
  const { remaining } = stageCounts(claim);
  if (remaining.length === 0) return "Nothing follows this stage.";
  return `Still to come: ${remaining.map((s) => s.name).join(", ")}.`;
}

/**
 * Three or four sentences on where the case stands.
 *
 * A live reassessment still wins: when the case agent has something to say about
 * a route change, that is more urgent than a progress report and it says it in
 * its own words.
 */
export function caseProgressSummary(claim: InjuryClaim): string {
  if (claim.reassessment) return claim.reassessment.detail;

  const { done, total } = stageCounts(claim);
  const opened = relativeTime(claim.openedAt).replace(" ago", "");
  const clock = formatRemaining(claim.elapsedMinutes, claim.slaMinutes);

  const sentences = [
    `${done} of ${total} stages are complete. The case has been open for ${opened} ` +
      `and is now in ${claim.currentStage}, owned by ${claim.owner}.`,
    behind(claim),
    claim.evidence.length > 0
      ? `${claim.evidence.length} documents are attached and read.`
      : "No documents are attached yet.",
    ahead(claim),
    `The stage clock is ${claim.slaStatus.toLowerCase()} with ${clock}.`,
  ];

  if (claim.activeLanes.length > 0) {
    sentences.push(
      `${claim.activeLanes.join(" and ")} ${
        claim.activeLanes.length === 1 ? "is" : "are"
      } running alongside it.`,
    );
  }

  return sentences.filter(Boolean).join(" ");
}

/**
 * The facts under the summary.
 *
 * Progress facts, not decision facts. "Why it needs a person" used to sit here
 * and is now only on the Action needed card, which is where someone acts on it.
 */
export function caseProgressFacts(
  claim: InjuryClaim,
): { label: string; value: string }[] {
  const { done, total } = stageCounts(claim);
  return [
    { label: "Progress", value: `${done} of ${total} stages complete` },
    { label: "Current stage", value: claim.currentStage },
    {
      /*
        "Coverage.Position" is a property-claims variable and does not exist in
        the injury case plan, so this bullet read "Not yet set" on every case
        however far it had got. The injury plan carries liabilityOutcome once a
        decision is recorded and liabilityBasisCode from investigation onwards.
      */
      label: "Liability position",
      value: String(
        claim.variables["liabilityOutcome"] ??
          claim.variables["liabilityBasisCode"] ??
          "Not yet set",
      ),
    },
    {
      label: "Open lanes",
      value: claim.activeLanes.length ? claim.activeLanes.join(", ") : "None",
    },
    { label: "Last update", value: relativeTime(claim.lastUpdatedAt) },
  ];
}
