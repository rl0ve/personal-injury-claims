// Domain types for the Personal Injury Claims Resolution case.
//
// Names mirror the case design so the app, the case plan, and the SDD all use
// one vocabulary. Sources:
//   • docs/injury-claims-resolution-sdd.md: §1 variables, §2 stages/tasks, §3 personas
//   • Use Case Explorer case design:   the eight primary stages + conditional lanes
//   • FUSION 2026 storyboard, Act II:  the queue, the console, the execution trail
//
// When the real Maestro case is published, `caseService.ts` maps its stage and
// task names onto these types; nothing else in the app needs to change.

/**
 * Who or what performs a task. `agent` / `process` / `human` / `api` match the
 * AG / PR / HT / API legend on the case design; `timer` is the SDD's
 * wait-for-timer task, and `event` appears only in the execution trail, where an
 * inbound signal is an actor in its own right.
 */
export type TaskActor = "agent" | "process" | "human" | "api" | "timer" | "event";

/** A stage is either on the required spine or a conditional lane off it. */
export type StageKind = "primary" | "conditional" | "terminal";

/**
 * Runtime state of a stage on one case instance. `skipped` is a stage the case
 * moved past without entering, which is a real outcome here, since liability and
 * medical evidence run as parallel tracks and lanes are conditional.
 */
export type StageState = "completed" | "active" | "skipped" | "pending";

export type TaskState = "completed" | "active" | "blocked" | "pending" | "skipped";

/** Case-level SLA health. Drives every SLA pill and countdown in the app. */
export type SlaStatus = "On track" | "At risk" | "Breached" | "Met" | "Paused" | "Not triggered";

/** SDD §1: choiceset P1–P4, default P3. P1 drives the 24-hour case SLA override. */
export type Priority = "P1" | "P2" | "P3" | "P4";

/**
 * Why a case is sitting in a person's queue. The storyboard's point is that the
 * queue holds only cases where a person can change the outcome, and each one
 * says why, so this is a first-class field rather than a derived label.
 */
export type QueueReason =
  // The first two are the ones the bundled dataset uses today.
  | "Waiting on new medical information"
  | "Settlement ready for authorisation"
  | "Treatment exceeds the assessed track"
  | "Treatment exceeds the approved plan"
  | "Subrogation candidate confirmed, gates closure"
  | "Medical evidence incomplete or contradictory"
  | "Alternative treatment needs authority approval"
  | "Quantum exceeds delegated authority"
  | "Claimant challenged the outcome"
  | "SIU referral required before closure";

export type CaseStatus = "Action required" | "Waiting on others" | "Progressing" | "Closed";

export interface StageDefinition {
  id: string;
  name: string;
  kind: StageKind;
  /** Human-readable SLA target as it appears on the case design. */
  sla: string;
  /** SLA budget in minutes, for countdown math. Null when the target is not a clock. */
  slaMinutes: number | null;
  owner: string;
  description: string;
  tasks: TaskDefinition[];
}

export interface TaskDefinition {
  id: string;
  name: string;
  actor: TaskActor;
  /** SDD §4: the Action App dispatch code for `human` tasks. */
  actionType?: string;
  /** Decision buttons a human task offers, in the order the Action App renders them. */
  outcomes?: string[];
}

/**
 * The subject of the claim: the injury under assessment and its cover position.
 *
 * Field names are historical and deliberately generic; what they carry here is
 * injury data (`model` = injury type, `serial` = claim/medical reference,
 * `inServiceMonths` = months since the accident, `coverageStatus` = the
 * liability and cover position).
 */
export interface CaseAsset {
  model: string;
  serial: string;
  description: string;
  inServiceMonths: number;
  coverageStatus: string;
  /**
   * The claim reference was matched against the policy record.
   *
   * Worth stating on the decision header rather than assuming: everything the
   * liability argument says about cover and period rests on this being the
   * claimant the policy covers.
   */
  identityConfirmed?: boolean;
}

/**
 * A field IXP pulled out of a document.
 *
 * `inferred` marks the interesting ones: values stated nowhere in the document
 * that had to be derived by reading two things against each other. Those are the
 * ones worth showing a confidence on, and the ones a reviewer should check.
 */
export interface ExtractedField {
  label: string;
  value: string;
  /** Derived rather than read off the page. */
  inferred?: boolean;
  /** 0–100. Omitted where the model returned nothing, which is a valid answer. */
  confidence?: number;
  /** Where in the document it came from, or which clauses it was derived from. */
  source?: string;
}

export interface EvidenceDocument {
  id: string;
  kind: "pdf" | "log" | "zip" | "image";
  title: string;
  /** Short verdict shown beside the title, e.g. "Soft-tissue injury confirmed". */
  verdict?: string;
  /** Rendered as the expanded body. Supports a simple table for structured evidence. */
  body?: string;
  table?: { columns: string[]; rows: string[][] };
  addedAt: string;
  addedBy: string;
  isNew?: boolean;
  /** Signal capture (storyboard scene 14): did this evidence actually help? */
  helpful?: boolean | null;

  // ── The real document behind the summary ──────────────────────────────────
  /** Path under `public/`, served relative so it works at any mount point. */
  fileUrl?: string;
  pages?: number;
  /** Who issued it. A third party's document looks nothing like ours. */
  issuer?: string;
  /** Document reference: medical record number, IME report number, claim reference. */
  reference?: string;
  /** What IXP pulled out, shown beside the page image in the viewer. */
  extracted?: ExtractedField[];
}

/** One row of the execution trail, from storyboard scene 16. */
export interface TrailEntry {
  seq: number;
  actor: TaskActor;
  actorLabel: string;
  step: string;
  stage: string;
  time: string;
}

/** A case-agent recommendation attached to a decision or a mid-case reassessment. */
export interface AgentRecommendation {
  headline: string;
  detail: string;
  confidence: "low" | "medium" | "medium-high" | "high";
  /** What the agent is proposing to do, as the preselected option. */
  recommendedOutcome: string;
  evidenceBasis: string[];
}

export interface DecisionOption {
  outcome: string;
  label: string;
  /** Why this option is or isn't supported. Shown under the label in the console. */
  rationale: string;
  supported: boolean;

  // ── What choosing this option does ────────────────────────────────────────
  // Present on the combined-cause console. Picking a position re-attributes
  // every cost line, which moves the totals and the authority meter with it,
  // that is the point of the screen: you can see what a position costs before
  // you sign it.
  /** Line id → where it lands under this position. */
  allocation?: Record<string, CostAttribution>;
  /** The rationale this position starts from. Empty where the signer must write one. */
  draftRationale?: string;
  /** Set when this position departs from the recommendation and needs a reason. */
  overrideNote?: string;
  /** What this position sets in motion. `hold` marks something that will not proceed. */
  effects?: DecisionEffect[];
}

// ── The liability-decision console ──────────────────────────────────────────
//
// A disputed-liability decision needs more than a list of buttons: the two
// established findings side by side, the money split by attribution, and the
// signer's delegated limit. These fields are optional on `CaseAction`, since an action
// that carries them renders the rich console, one that does not renders the plain
// decision form. Transcribed from `docs/coverage-decision-wiith-signals.html`.

/** One established finding, and which way it points. */
export interface DecisionCause {
  /** "covered" tints green and reads "admitted"; "excluded" tints red, "disputed". */
  side: "covered" | "excluded";
  label: string;
  title: string;
  body: string;
  /**
   * The body in one clause, for the collapsed row.
   *
   * Not a truncation of `body`. The first sentence of a finding is usually its
   * setup, not its point. Absent, the row falls back to trimming the body,
   * which reads worse but never leaves the row blank.
   */
  summary?: string;
  /** "→ Points to covered" / "→ Points to excluded". */
  points: string;
  /** Provenance stamp, e.g. "ESTABLISHED 03-20 IME REPORT". */
  established: string;
  /** Systems the finding came from. */
  sources: string[];
}

/**
 * Who carries a cost line. The two codes are historical: `vendor` is the
 * insurer's share, `customer` is the claimant's share.
 */
export type CostParty = "vendor" | "customer";

/**
 * One line of the claim, e.g. general damages or care and rehabilitation costs.
 * The amount belongs to the line; who carries it belongs to the liability
 * position, so it is NOT stored here. A claim does not change shape when the
 * decision does.
 */
export interface CostLine {
  id: string;
  name: string;
  amount: number;
}

/** Where one line lands under a given liability position, and why. */
export interface CostAttribution {
  to: CostParty;
  /** The attribution in one clause, like "Reduced for contributory negligence". */
  why: string;
  /** Absorbed as goodwill rather than owed. */
  goodwill?: boolean;
}

/** The signer's delegated limit and who a decision above it routes to. */
export interface DecisionAuthority {
  limit: number;
  /** Named on screen when the decision routes past the signer. */
  approver: string;
}

/**
 * One clause of the policy, tested against this claim.
 *
 * `open` is its own verdict rather than a failed pass: a check nobody could run
 * is not a check that came back clean, and the difference is the whole argument
 * about contributory negligence. It is unestablished, so it has not been
 * charged to anyone.
 */
export interface PolicyCheck {
  id: string;
  verdict: "pass" | "fail" | "open";
  name: string;
  /** What was tested and what came back, in one line. */
  detail: string;
  /** The system that answered: Injury Claims Gateway, Injury Policy Gateway, Injury Severity Data Gateway, Case. */
  source?: string;
}

/** A collapsible detail row. Present so it is on the record, folded so it is not noise. */
export interface DetailFold {
  id: string;
  label: string;
  summary: string;
  /** Count of items a reviewer flagged inside, shown as a chip. */
  marked?: number;
  body?: string;
  /** Renders as the policy-test table rather than prose. */
  checks?: PolicyCheck[];
}

/**
 * One thing the agent leaned on, and what it bought.
 *
 * The assessment rail lists these under the recommendation so the reasoning is
 * inspectable line by line rather than as one paragraph to take or leave, and
 * each carries a thumb, because which signal was misread is more useful
 * feedback than whether the conclusion felt right.
 */
export interface AgentSignal {
  id: string;
  importance: "high" | "medium" | "low";
  /** The one-line name in the list. */
  short: string;
  /** What this signal supports, in money where it maps to money. */
  backs: string;
  /** The full argument, shown when the signal is opened. */
  detail: string;
  sources: string[];
}

/** How comparable cases went. One bar segment and one row. */
export interface PrecedentSlice {
  /** The option's outcome code, so the reader's own position can be marked. */
  outcome: string;
  label: string;
  cases: number;
}

/**
 * A reply the rail offers rather than making the reader type it.
 *
 * `forOptions` is what makes them feel answered rather than generic: the
 * objections worth raising against a liability denial are not the ones worth
 * raising against a full admission, so a chip only appears where it would
 * actually be said.
 */
export interface SuggestedReply {
  id: string;
  kind: "disagree" | "missing-context" | "ask-back" | "agree";
  label: string;
  /** What the reader is taken to have said, in full, when they pick it. */
  body: string;
  /** The agent's answer. */
  answer: string;
  /** Positions this reply belongs to. Absent ⇒ every position. */
  forOptions?: string[];
}

/** Something that happens downstream when the decision is submitted. */
export interface DecisionEffect {
  title: string;
  detail?: string;
  /** Held rather than released. Rendered as a pause, not a tick. */
  hold?: boolean;
}

/**
 * What the signer says about the agent's reasoning, kept separate from the outcome.
 *
 * This is the learning signal: not which option was picked, but whether the
 * reasoning behind it held, and whether the agent should keep asking. Recorded
 * to the decision ledger and read later by continuous improvement.
 */
export type ReasoningVerdict = "agree" | "agree-keep-asking" | "stop-asking";

export interface ReasoningOption {
  value: ReasoningVerdict;
  label: string;
  /** What recording this choice actually does. */
  effect: string;
}

/** An open human task: a row in the queue and the subject of the decision console. */
export interface CaseAction {
  id: string;
  caseId: string;
  /** Matches TaskDefinition.actionType, e.g. "coverage-decision" (the liability and cover position). */
  actionType: string;
  title: string;
  stage: string;
  assignee: string;
  priority: Priority;
  blocking: boolean;
  dueAt: string;
  slaMinutes: number;
  elapsedMinutes: number;
  whyThisReachedYou: string;
  options: DecisionOption[];
  recommendation: AgentRecommendation;
  /** Peer context the signal-capture rail shows, e.g. "78% ended in partial plus goodwill". */
  peerContext?: string;
  status: "Open" | "Completed";
  completedOutcome?: string;
  completedBy?: string;
  completedAt?: string;
  rationale?: string;
  /** What the signer said about the reasoning, recorded alongside the outcome. */
  completedReasoning?: ReasoningVerdict;

  // ── Rich console (optional) ───────────────────────────────────────────────
  // Present together or not at all. `causes` is the switch: an action that has
  // them renders the disputed-liability console, one that does not renders the
  // plain decision form.
  causes?: DecisionCause[];
  /** The line under the findings: "Both are established. Neither is sole." */
  verdict?: { headline: string; detail: string };
  costLines?: CostLine[];
  authority?: DecisionAuthority;
  folds?: DetailFold[];
  effects?: DecisionEffect[];
  /** Total claim as filed, before attribution. */
  claimTotal?: number;
  claimLineSummary?: string;
  /** 0–100, shown as a meter beside the recommendation. */
  confidencePercent?: number;
  /** How often peers agreed with this recommendation. */
  precedent?: string;
  /** The same figure broken out, for the rail's distribution bar. */
  precedentBreakdown?: PrecedentSlice[];
  /** The population the breakdown is drawn from, like "Last 18 months · disputed liability". */
  precedentBasis?: string;
  /** What the agent leaned on, listed under the recommendation. */
  signals?: AgentSignal[];
  /** Replies the rail offers, filtered by the position currently selected. */
  replies?: SuggestedReply[];
  /** Two header tiles: what is burning, and when this is due. */
  tiles?: { label: string; value: string; note: string; tone: "alarm" | "clock" }[];
  /** The agent's draft rationale, restorable after the signer edits it. */
  draftRationale?: string;
}

// ── Activity feed ───────────────────────────────────────────────────────────
//
// Who did a thing, at what altitude. `rules` is a deterministic case-manager
// decision; `ai` is the case-manager agent reasoning; `agent` is a task-executing
// agent; `task` is plain automation (a process or API call).
export type ActivityCategory = "human" | "rules" | "ai" | "agent" | "task";

/** Stage transitions sit above milestones, which sit above individual tasks. */
export type ActivityLevel = "stage" | "milestone" | "task" | "reassignment";

/** The lifecycle of a human task: who it landed on, handoffs, drafts, completion. */
export type HitlEventKind = "assigned" | "reassigned" | "draft" | "completed";

export interface HitlEvent {
  kind: HitlEventKind;
  /** Person the task landed on (assignee / reassignee / who saved or completed). */
  actor: string;
  /** Previous owner, for a reassignment. */
  from?: string;
  time: string;
}

export interface ActivityItem {
  id: string;
  category: ActivityCategory;
  level?: ActivityLevel;
  actor: string;
  title: string;
  detail?: string;
  /** ISO timestamp. Rendered relative, filtered absolutely. */
  time: string;
  stage?: string;
  /** The open action this event corresponds to, if any. Lets a card deep-link. */
  actionId?: string;
  /** For human tasks: the assignment → completion history, shown when expanded. */
  hitl?: HitlEvent[];
}

export interface CaseComment {
  author: string;
  role: string;
  time: string;
  text: string;
}

/** One clock on the case, at case, stage, or action level. */
export interface CaseSlaEntry {
  id: string;
  level: "case" | "stage" | "action";
  label: string;
  dueAt: Date;
  status: SlaStatus;
  /** What makes this clock start. Shown on the SLAs tab. */
  condition?: string;
}

/**
 * What the account is worth and what it has already cost: the commercial frame
 * a goodwill decision is made inside.
 *
 * Read-only, and from the Injury Policy Gateway rather than the case: a claims
 * officer does not set an account's tier or its credit balance, they weigh them.
 * It sits with the case because the goodwill line on the decision is unarguable
 * without it. Absorbing £1,240 of care costs reads differently against £312,000
 * already paid out than it does against none.
 */
export interface CustomerStanding {
  /** Premium value per year. */
  annualValue: number;
  /** When the policy comes up for renewal. */
  renewalDate: string;
  /** SLA credits issued this year, before this claim. */
  slaCreditsYtd: number;
  /** This claim has crossed the threshold that owes the claimant a credit. */
  creditTriggered: boolean;
  /** Goodwill granted in the last twelve months. */
  goodwill12mo: number;
  contactName: string;
  contactRole: string;
  /** ISO date of the last conversation. */
  lastSpokenAt: string;
  /** Which channel it went through. */
  lastSpokenVia: string;
  /** System of record, named because this is not the case's own data. */
  source: string;
}

export interface InjuryClaim {
  /** Business identifier, e.g. CLAIM-5170. */
  id: string;
  /** Commercial standing, like "Strategic". Sits beside the claimant's name. */
  customerSegment?: string;
  /** The account's commercial position. Absent ⇒ the card is not shown. */
  standing?: CustomerStanding;
  /** Maestro case instance GUID. Empty for demo rows that have no live counterpart. */
  instanceId: string;
  folderKey: string;
  customer: string;
  site: string;
  asset: CaseAsset;
  priority: Priority;
  status: CaseStatus;
  /** Stage the case is currently in, meaning the latest entered primary stage. */
  currentStage: string;
  /** Conditional lanes currently open alongside the primary stage. */
  activeLanes: string[];
  owner: string;
  ownerRole: string;
  description: string;
  queueReason?: QueueReason;
  claimValue: number;
  lineStatus?: string;
  lineDownHours?: number;
  openedAt: string;
  lastUpdatedAt: string;
  slaMinutes: number;
  elapsedMinutes: number;
  slaStatus: SlaStatus;
  /** Per-stage runtime state, keyed by stage id. Absent ⇒ pending. */
  stageStates: Record<string, StageState>;
  evidence: EvidenceDocument[];
  trail: TrailEntry[];
  /** Set when an event has woken the case agent and it wants a route changed. */
  reassessment?: AgentRecommendation & { trigger: string };
  /** SDD §1 case variables, surfaced on the Details tab and the instance view. */
  variables: Record<string, string | number>;
  /** Multi-actor feed for the Activity tab. Empty ⇒ derived from stage states. */
  activity: ActivityItem[];
  comments: CaseComment[];
  /**
   * How this case's case manager decides. Labels the Activity tab's filter.
   * "rules" reads as Rules; agent and hybrid read as Case manager.
   */
  caseManagerMode: "rules" | "agent" | "hybrid";
  closureReason?: string;
  /** False for rows sourced from the bundled demo dataset rather than Maestro. */
  isLive: boolean;
  /**
   * Under the overlay flag, the demo case this row is painted over.
   *
   * The row wears the live instance's id, so the demo id it started as would
   * otherwise be lost, and the demo actions still refer to the case by it.
   */
  overlaidFrom?: string;
}

/** Portfolio-level numbers for the Performance page, from storyboard scene 12. */
export interface OperationalInsights {
  autonomousRate: number;
  interventionRate: number;
  atSlaRisk: number;
  bottleneckStage: string;
  bottleneckLabel: string;
  queueEntryTrend: { period: string; entered: number; completed: number }[];
  /** Seven-day SLA posture, oldest first. This is what the brief's sparkline plots. */
  slaTrend: { onTrack: number[]; breached: number[] };
  stageAccumulation: { stage: string; cases: number }[];
  /** Personal KPIs on the queue page, from storyboard scene 13. */
  /** Average days to a liability and cover position. */
  avgCoverageDecisionDays: number;
  /** Adherence to agreed rehabilitation and return-to-work plans. */
  restorationAdherence: number;
  criticalAtRisk: number;
  criticalAtRiskDelta: number;
  repeatFailureCandidates: number;
  repeatFailureNote: string;
}
