// The case plan: eight primary stages on the spine, conditional lanes hanging
// off it, and the terminal lanes that end a case without completing it.
//
// This file is the single place the case shape is declared. It is transcribed
// from the "Personal Injury Claims Resolution Case Design" reference
// implementation, cross-checked against docs/injury-claims-resolution-sdd.md §2. When the
// real Maestro case is published, reconcile THIS file with it. `caseService.ts`
// matches live stage/task names against these definitions by normalised name, so
// keeping the names identical is what wires the app to the running case.
//
// SLA targets are the design's illustrative ones, which is what the demo shows
// on screen (the console header reads "SLA 4 HR" for Medical Evidence &
// Treatment). The SDD proposes a more conservative set for production, noted
// per stage below, and both are deliberately kept visible.

import type { StageDefinition, TaskActor, TaskDefinition } from "./types";

const HOUR = 60;
const DAY = 24 * HOUR;

/** Primary stages, in the order the case enters them. */
export const PRIMARY_STAGES: StageDefinition[] = [
  {
    id: "s1",
    name: "Claim Intake & Registration",
    kind: "primary",
    sla: "30 min critical triage",
    slaMinutes: 30,
    owner: "Claims Intake Centre",
    description:
      "Registers the injury notification, acknowledges the claimant's report, classifies injury severity and urgency, and verifies the claimant's details and policy so the claim can be linked to cover.",
    // SDD §2 s1 proposes 1 d at 75% at-risk.
    tasks: [
      { id: "t11", name: "Create and correlate claim record", actor: "process" },
      { id: "t12", name: "Identify claimant and policy", actor: "api" },
      {
        id: "t13",
        name: "Classify injury severity",
        actor: "human",
        actionType: "assess-impact",
        outcomes: ["Assessed"],
      },
      { id: "t14", name: "Preserve and summarize initial evidence", actor: "agent" },
    ],
  },
  {
    id: "s2",
    name: "Injury Triage & Track Assignment",
    kind: "primary",
    sla: "2 hr assignment",
    slaMinutes: 2 * HOUR,
    owner: "Aldergate Claims Operations",
    description:
      "Assigns an injury assessor proportionate to the severity, issues triage instructions covering the claim track and immediate care needs, and confirms the assessor has accepted the case.",
    tasks: [
      { id: "t21", name: "Assign injury assessor", actor: "process" },
      { id: "t22", name: "Draft triage instructions", actor: "agent" },
      {
        id: "t23",
        name: "Confirm assessor acceptance",
        actor: "human",
        actionType: "adjuster-acceptance",
        outcomes: ["Accepted", "Reassign"],
      },
      { id: "t24", name: "Schedule medical assessment", actor: "process" },
    ],
  },
  {
    id: "s3",
    name: "Liability Assessment & Admission",
    kind: "primary",
    sla: "2 hr early intervention recommendation",
    slaMinutes: 2 * HOUR,
    owner: "Injury Assessment",
    description:
      "Correlates accident circumstances and the police report with the reported injury, gets emergency treatment approved so the claimant's condition does not worsen, and records the liability position and contributory negligence view.",
    // SDD §2 s3 proposes 4 h at 75% at-risk, the P1 downtime driver.
    tasks: [
      { id: "t31", name: "Correlate accident circumstances and police report", actor: "agent" },
      {
        id: "t32",
        name: "Approve emergency treatment",
        actor: "human",
        actionType: "containment-approval",
        outcomes: ["Approved", "Rejected"],
      },
      { id: "t33", name: "Coordinate claimant-arranged treatment", actor: "process" },
      {
        id: "t34",
        name: "Record liability position and contributory negligence",
        actor: "human",
        actionType: "diagnose",
        outcomes: ["RouteReady", "EngineeringNeeded"],
      },
    ],
  },
  {
    id: "s4",
    name: "Medical Evidence & Quantum Decision",
    kind: "primary",
    sla: "4 hr initial review",
    slaMinutes: 4 * HOUR,
    owner: "Aldergate Claims Operations",
    description:
      "Assembles medical records and the treatment plan, flags what is missing or contradictory, reviews prior claims and policy limits, and records the liability and cover position with a written rationale.",
    // SDD §2 s4 proposes 5 d at 70% at-risk; task SLA 5 d on the liability decision.
    tasks: [
      { id: "t41", name: "Assemble medical records and GP history", actor: "api" },
      { id: "t42", name: "Flag missing and conflicting medical facts", actor: "agent" },
      {
        id: "t43",
        name: "Review policy limits and prior claims",
        actor: "human",
        actionType: "configuration-review",
        outcomes: ["Reviewed", "OutOfEnvelope"],
      },
      {
        id: "t44",
        name: "Form liability and cover position",
        actor: "human",
        actionType: "coverage-decision",
        outcomes: ["Approved", "PartialPlusGoodwill", "Denied", "ExceptionPending", "EvidenceRequested"],
      },
    ],
  },
  {
    id: "s5",
    name: "Rehabilitation & Return-to-Work",
    kind: "primary",
    sla: "2 hr referral after readiness",
    slaMinutes: 2 * HOUR,
    owner: "Provider Network",
    description:
      "Reserves and tracks approved rehabilitation funding, refers the claimant to a qualified physiotherapy or treatment provider, confirms the claimant is fit to begin, and captures the claimant's validation of the return-to-work plan.",
    // SDD §2 s5 proposes 3 d at 75% at-risk (provisional, SME review item 5).
    tasks: [
      { id: "t51", name: "Reserve and track approved treatment funding", actor: "api" },
      { id: "t52", name: "Refer to qualified rehabilitation provider", actor: "process" },
      {
        id: "t53",
        name: "Confirm fitness to begin treatment",
        actor: "human",
        actionType: "service-readiness",
        outcomes: ["Ready", "Blocked"],
      },
      {
        id: "t54",
        name: "Validate return-to-work plan",
        actor: "human",
        actionType: "customer-validation",
        outcomes: ["Validated", "Failed"],
      },
    ],
  },
  {
    id: "s6",
    name: "Treatment Delivery & Provider Management",
    kind: "primary",
    sla: "4 hr in-policy decision",
    slaMinutes: 4 * HOUR,
    owner: "Aldergate Claims Operations",
    description:
      "Builds comparable quantum and settlement options, evaluates them against the policy and delegated authority, and authorises the settlement route the claim will take.",
    // SDD §2 s6 proposes 1 d at 75% at-risk; readiness task SLA 1 d.
    tasks: [
      { id: "t61", name: "Build comparable quantum and settlement options", actor: "agent" },
      { id: "t62", name: "Evaluate policy and delegated authority", actor: "api" },
      {
        id: "t63",
        name: "Approve quantum exception",
        actor: "human",
        actionType: "joint-readiness",
        outcomes: ["BothReady", "ApprovedException", "ReturnToCoverage", "ReturnToTechnical"],
      },
      {
        id: "t64",
        name: "Authorize settlement outcome",
        actor: "human",
        actionType: "route-approval",
        outcomes: [
          "Repair",
          "Replacement",
          "AlternatePart",
          "Denial",
          "Withdrawal",
          "CommercialLegal",
        ],
      },
    ],
  },
  {
    id: "s7",
    name: "Subrogation & Recovery",
    kind: "primary",
    sla: "Before claim closure",
    slaMinutes: 2 * DAY,
    owner: "Recovery & Subrogation",
    description:
      "Screens for third-party liability and recoverable outlay and records the recovery disposition before a claim can close.",
    tasks: [
      { id: "t71", name: "Screen for third-party recovery potential", actor: "agent" },
      {
        id: "t72",
        name: "Confirm recovery disposition",
        actor: "human",
        actionType: "quality-disposition",
        outcomes: ["InvestigationOpened", "MonitoringPlan", "NoAction"],
      },
      { id: "t73", name: "Open recovery referral to third-party insurer", actor: "process" },
      {
        id: "t74",
        name: "Assign recovery owner",
        actor: "human",
        actionType: "learning-owner",
        outcomes: ["Assigned"],
      },
    ],
  },
  {
    id: "s8",
    name: "Settlement & Closure",
    kind: "primary",
    sla: "1 business day",
    slaMinutes: DAY,
    owner: "Claims Quality",
    description:
      "Reconciles the settlement against the assessed damages, finalises the decision ledger, and confirms closure or routes to a recovery escalation.",
    // SDD §2 s8 proposes 10 d at 70% at-risk (provisional, SME review item 5).
    tasks: [
      { id: "t81", name: "Reconcile settlement and assessed damages", actor: "api" },
      { id: "t82", name: "Finalize decision ledger", actor: "agent" },
      {
        id: "t83",
        name: "Confirm closure or recovery escalation",
        actor: "human",
        actionType: "closure-disposition",
        outcomes: ["Close", "QualityInvestigation", "Reopen"],
      },
    ],
  },
];

/**
 * Conditional lanes. These are the three the case design draws and the three
 * the storyboard's stage rail lists, so they are the ones the demo can open.
 */
export const CONDITIONAL_STAGES: StageDefinition[] = [
  {
    id: "sx1",
    name: "Emergency Treatment & Early Intervention",
    kind: "conditional",
    sla: "Reminders per severity tier",
    slaMinutes: 3 * DAY,
    owner: "Aldergate Claims Operations",
    description:
      "Requests the specific medical evidence that is missing from the claimant, tracks the response, and resumes the decision clock the moment it lands.",
    tasks: [
      { id: "sx11", name: "Request targeted medical evidence", actor: "process" },
      { id: "sx12", name: "Summarize new uploads", actor: "agent" },
      {
        id: "sx13",
        name: "Review evidence sufficiency",
        actor: "human",
        actionType: "evidence-followup",
        outcomes: ["Received", "EscalatedNoResponse"],
      },
      { id: "sx14", name: "Resume affected decision clock", actor: "api" },
    ],
  },
  {
    id: "sx2",
    name: "Condition Deterioration & Re-assessment",
    kind: "conditional",
    sla: "4 hr critical review",
    slaMinutes: 4 * HOUR,
    owner: "Independent Medical Examination",
    description:
      "Prepares the IME exception brief and takes the prognosis, causation, and impairment-rating decision that no rule can settle.",
    tasks: [
      { id: "sx21", name: "Prepare IME exception brief", actor: "agent" },
      {
        id: "sx22",
        name: "Review causation and prognosis",
        actor: "human",
        actionType: "engineering-exception",
        outcomes: ["Approved", "ReturnForDiagnosis", "ControlledEscalation"],
      },
      {
        id: "sx23",
        name: "Approve revised treatment plan",
        actor: "human",
        actionType: "deviation-approval",
        outcomes: ["Approved", "Rejected"],
      },
      { id: "sx24", name: "Notify resolution owner", actor: "process" },
    ],
  },
  {
    id: "sx3",
    name: "Escalation & Authority Referral",
    kind: "conditional",
    sla: "Same-day review",
    slaMinutes: 2 * DAY,
    owner: "Provider Network",
    description:
      "Checks approved treatment alternatives and provider availability, compares equivalent-care evidence, and takes the authority approval an alternative treatment route requires.",
    tasks: [
      { id: "sx31", name: "Check approved alternatives and provider availability", actor: "api" },
      { id: "sx32", name: "Compare equivalent-care evidence", actor: "agent" },
      {
        id: "sx33",
        name: "Approve alternative treatment and review",
        actor: "human",
        actionType: "parts-substitution",
        outcomes: ["Approved", "Rejected", "Escalate"],
      },
      { id: "sx34", name: "Update reserve and commitment", actor: "process" },
    ],
  },
];

/**
 * Terminal lanes from SDD §2 (sx5–sx8). They end the case without completing it,
 * so they sit off the progress rail and only appear once entered. The case
 * design diagram does not draw them; the SDD's exit conditions require them.
 */
export const TERMINAL_STAGES: StageDefinition[] = [
  {
    id: "sx5",
    name: "Liability Denial & Adverse Decision",
    kind: "terminal",
    sla: "Not set",
    slaMinutes: null,
    owner: "Aldergate Claims Operations",
    description: "Records the liability denial and issues the claimant notice. Exits the case as denied.",
    tasks: [
      {
        id: "sx51",
        name: "Record denial and notify claimant",
        actor: "human",
        actionType: "denial-notice",
        outcomes: ["DenialRecorded"],
      },
    ],
  },
  {
    id: "sx6",
    name: "SIU & Investigative Restriction",
    kind: "terminal",
    sla: "Not set",
    slaMinutes: null,
    owner: "Aldergate Claims Operations",
    description:
      "Records an SIU investigative restriction, the confirming contact, and any work already incurred.",
    tasks: [
      {
        id: "sx61",
        name: "Record investigative restriction",
        actor: "human",
        actionType: "withdrawal",
        outcomes: ["WithdrawalRecorded"],
      },
    ],
  },
  {
    id: "sx7",
    name: "Litigation Management",
    kind: "terminal",
    sla: "Not set",
    slaMinutes: null,
    owner: "Special Investigations / Legal",
    description:
      "Hands the full decision history to the receiving legal team after a controlled escalation, e.g. proceedings issued. Exits the case.",
    tasks: [
      {
        id: "sx71",
        name: "Handoff to litigation management",
        actor: "human",
        actionType: "commercial-legal",
        outcomes: ["HandoffAccepted"],
      },
    ],
  },
  {
    id: "sx8",
    name: "Complaint & Ombudsman Referral",
    kind: "terminal",
    sla: "Not set",
    slaMinutes: null,
    owner: "Aldergate Claims Operations",
    description:
      "Records why a claimant complaint or ombudsman referral is raised and returns the claim to liability, quantum, or closure reassessment with history preserved.",
    tasks: [
      {
        id: "sx81",
        name: "Record complaint or ombudsman referral",
        actor: "human",
        actionType: "reopen",
        outcomes: ["CoverageReassessment", "TechnicalReassessment", "ClosureReassessment"],
      },
    ],
  },
];

export const ALL_STAGES: StageDefinition[] = [
  ...PRIMARY_STAGES,
  ...CONDITIONAL_STAGES,
  ...TERMINAL_STAGES,
];

export const PRIMARY_STAGE_NAMES = PRIMARY_STAGES.map((s) => s.name);

/** Normalise a stage or task name so live Maestro names match these definitions. */
export function normaliseName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]/g, "");
}

const STAGE_BY_NORMALISED = new Map(ALL_STAGES.map((s) => [normaliseName(s.name), s]));

export function findStage(name: string): StageDefinition | undefined {
  return STAGE_BY_NORMALISED.get(normaliseName(name));
}

export function stageById(id: string): StageDefinition | undefined {
  return ALL_STAGES.find((s) => s.id === id);
}

export function findTask(actionType: string): TaskDefinition | undefined {
  for (const stage of ALL_STAGES) {
    const task = stage.tasks.find((t) => t.actionType === actionType);
    if (task) return task;
  }
  return undefined;
}

/** The stage a given action type belongs to. Used to label a task in the queue. */
export function stageForActionType(actionType: string): StageDefinition | undefined {
  return ALL_STAGES.find((s) => s.tasks.some((t) => t.actionType === actionType));
}

export const ACTOR_LABEL: Record<TaskActor, string> = {
  agent: "Agent",
  process: "Process",
  human: "Human",
  api: "API",
  timer: "Timer",
  event: "Event",
};

/** Short chips matching the case design legend. */
export const ACTOR_CHIP: Record<TaskActor, string> = {
  agent: "AG",
  process: "PR",
  human: "HT",
  api: "API",
  timer: "TM",
  event: "EVT",
};

/**
 * Case plan versions. v2 is the storyboard's live change: a recovery gate
 * added before a claim can close.
 */
export const CASE_PLAN_VERSIONS = [
  {
    version: "v1",
    label: "Initial case plan",
    publishedAt: "2026-08-14T09:00:00Z",
    note: "Seven primary stages, three conditional lanes.",
  },
  {
    version: "v2",
    label: "recovery gate",
    publishedAt: "2026-08-24T16:20:00Z",
    note: "Adds Subrogation & Recovery as a primary stage (4 tasks) between Treatment Delivery & Provider Management and Settlement & Closure. Settlement & Closure now requires recovery reviewed = true; the recovery-detected event targets the new stage. Running claims can migrate without restarting.",
  },
] as const;

export const CURRENT_PLAN_VERSION = "v2";
