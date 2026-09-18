// The bundled demo dataset.
//
// CLAIM-5182 is the hero claim: Joseph Thompson, injured in a rear-end road
// traffic accident, whose case is sitting in Medical Evidence & Quantum Decision
// waiting on new medical information. It is the claim this console sits
// alongside in the live tenant, and the one Dana opens on camera.
//
// CLAIM-5170 and CLAIM-5164 are the other two that need a person today:
// CLAIM-5170 is a soft-tissue claim whose settlement is ready for
// authorisation, and CLAIM-5164 is a claim where the claimant's condition has
// deteriorated and the treatment plan no longer matches the assessment. The
// remaining 38 open claims are generated deterministically so the counts the
// morning brief quotes hold up: 41 open, 3 needing a person, 38 progressing on
// their own.
//
// This dataset is the fallback whenever VITE_CASE_PROCESS_KEY is unset or the
// Maestro read fails. `caseService.ts` merges live instances over the top by id.

import { PRIMARY_STAGES } from "./casePlan";
import type {
  AgentSignal,
  CaseAction,
  OperationalInsights,
  PolicyCheck,
  PrecedentSlice,
  Priority,
  ReasoningOption,
  StageState,
  SuggestedReply,
  InjuryClaim,
} from "./types";

/**
 * Anchors every relative timestamp in this file.
 *
 * Captured at module load, NOT pinned to a fixed instant. A fixed instant looks
 * tidier but rots: the stored per-stage figures ("3 hr 12 min elapsed") stay put
 * while anything computed against real time drifts, so after a week on the shelf
 * the SLA rows and the activity feed contradict the header. Anchoring to load
 * keeps every relative figure (clocks, countdowns, "16 hr ago") saying the
 * same thing on any day, which is what the demo actually needs.
 */
export const DEMO_NOW = new Date();

function minutesAgo(m: number): string {
  return new Date(DEMO_NOW.getTime() - m * 60_000).toISOString();
}

function daysAgo(d: number): string {
  return minutesAgo(d * 24 * 60);
}

function minutesFromNow(m: number): string {
  return new Date(DEMO_NOW.getTime() + m * 60_000).toISOString();
}

/**
 * The claim, tested point by point against the hero case.
 *
 * Seven checks, and the two that are not clean passes are the case: liability
 * fails a clean admission because the third-party insurer alleges contributory
 * negligence, and the medical position is *open* — not decided against the
 * claimant, just undecided, because the updated records have not arrived. That
 * distinction is load-bearing. An open check has not been decided against the
 * claimant, which is why the rationale says the prognosis is unestablished
 * rather than unfavourable, and why nothing is finalised before the new
 * medical information lands.
 */
const POLICY_CHECKS_0421: PolicyCheck[] = [
  {
    id: "pc-term",
    verdict: "pass",
    name: "Accident within policy term",
    detail: "Accident 2026-08-31, policy runs to 2026-11-02",
    source: "Injury Policy Gateway",
  },
  {
    id: "pc-peril",
    verdict: "pass",
    name: "Bodily injury cover in force",
    detail: "Rear-end collision, personal injury indemnity and legal costs cover both engaged",
    source: "Injury Claims Gateway",
  },
  {
    id: "pc-cause",
    verdict: "pass",
    name: "Accident circumstances corroborated",
    detail: "Police report and dashcam footage both place the third party at the rear. No suggestion of a staged or induced collision",
    source: "Injury Severity Data Gateway",
  },
  {
    id: "pc-sumsinsured",
    verdict: "fail",
    name: "Liability admitted without reduction",
    detail:
      "The third-party insurer admits primary liability but alleges 25% contributory negligence for late braking. Liability settles at 75%.",
    source: "Injury Severity Data Gateway",
  },
  {
    id: "pc-ale",
    verdict: "pass",
    name: "Care and rehabilitation cover",
    detail: "Physiotherapy and home care approved 31 Aug. Within the claim's £30,000 care and rehabilitation limit",
    source: "Provider Network Gateway",
  },
  {
    id: "pc-evidence",
    verdict: "pass",
    name: "Evidence completeness",
    detail: "6 of 6 required items present",
    source: "Case",
  },
  {
    id: "pc-thirdparty",
    verdict: "open",
    name: "Long-term prognosis (updated medical records)",
    detail:
      "The treating consultant has requested a further review after the claimant's symptoms persisted past 12 weeks. Whether the injury is permanent is not established, and the updated records have not been obtained. This remains open at the point of decision.",
  },
];

/**
 * What the agent leaned on, in the order it matters.
 *
 * Five, not fifty: the rail is an argument, and an argument that lists
 * everything it touched is not one. Two carry the liability split itself, one
 * prices the rehabilitation, one flags what is deliberately not yet decided,
 * and the last is precedent, which is the signal a reviewer is most likely to
 * ask about, and so the one most worth having on the list.
 */
const SIGNALS_0421: AgentSignal[] = [
  {
    id: "sig-average-condition",
    importance: "high",
    short: "Contributory negligence alleged at 25%",
    backs: "Claimant bears the reduction, £51,000.00",
    detail:
      "The third-party insurer admits primary liability but alleges the claimant braked late and contributed to the collision. Its own reconstruction puts the claimant's share at 25%. On that basis general and special damages settle at 75p in the pound and the claimant bears the remaining 25%. This is an apportionment of liability, not a denial — the accident and the injury themselves are not in question.",
    sources: ["Injury Severity Data Gateway", "Injury Policy Gateway"],
  },
  {
    id: "sig-fire-covered",
    importance: "high",
    short: "Injury established, accident inside policy term",
    backs: "General + special damages, £153,000.00 before apportionment",
    detail:
      "Joseph Thompson was struck from behind at a junction and taken to hospital the same morning. The discharge summary records a whiplash-associated disorder with an L4/L5 disc protrusion, and the treating consultant signed him unfit for work for an initial twelve weeks. The police report and dashcam footage corroborate the circumstances, and cover is in force with no exclusion engaged. The injury itself is fully established before the contributory reduction is applied.",
    sources: ["Injury Claims Gateway", "Injury Severity Data Gateway"],
  },
  {
    id: "sig-ale-full",
    importance: "medium",
    short: "Care and rehabilitation not reduced by apportionment",
    backs: "Care, rehab and treatment costs, £15,900.00 paid in full",
    detail:
      "Care and rehabilitation costs and the claimant's treatment costs are met under their own limits, separate from the damages heads, so the contributory reduction does not touch them. The claimant has had 14 weeks of physiotherapy at £700/week, and medical and treatment costs to date are a further £6,100.00. Both are paid in full up to their own limits.",
    sources: ["Provider Network Gateway", "Case"],
  },
  {
    id: "sig-thirdparty-open",
    importance: "low",
    short: "Long-term prognosis left open",
    backs: "No final quantum position taken yet",
    detail:
      "Symptoms have persisted past the twelve-week mark the initial treatment plan assumed, and the treating consultant has asked for a further review. Whether the injury is permanent has not been established, and the updated records have not been obtained. It is on the record as unestablished rather than dismissed, and if a permanent impairment is confirmed this is the fact that would reopen the quantum assessment.",
    sources: ["None recorded"],
  },
  {
    id: "sig-precedent",
    importance: "medium",
    short: "Contributory negligence applied consistently on comparable claims",
    backs: "Supports the 75% apportionment",
    detail:
      "Across comparable rear-end collision claims where the third-party insurer alleged late braking, contributory negligence was accepted in the great majority of settlements, at the share the reconstruction assessed rather than a negotiated figure. Conceding nothing here would be the exception, not the rule.",
    sources: ["Case"],
  },
];

/**
 * How comparable claims went. Seventy percent agree is not an endorsement. It
 * is also thirty percent who did something else, which is why the two
 * dissenting positions are listed with their counts rather than rolled into
 * "other".
 */
const PRECEDENT_0421: PrecedentSlice[] = [
  { outcome: "PartialPlusGoodwill", label: "Settled, contributory negligence applied", cases: 22 },
  { outcome: "Approved", label: "Settled in full, no reduction", cases: 5 },
  { outcome: "Denied", label: "Liability denied", cases: 3 },
];

/**
 * The objections worth raising, per position.
 *
 * `forOptions` is what stops these reading as a generic feedback widget.
 * Moving to a denial and moving to a full settlement are opposite mistakes,
 * and the thing an agent should offer to hear about each is different: against
 * a denial, that the injury itself is not in question; against a full
 * settlement, that the late braking is not in question either. A chip that
 * fits every position fits none of them.
 */
const REPLIES_0421: SuggestedReply[] = [
  {
    id: "cr-which-clause-average",
    kind: "ask-back",
    label: "What reduces the damages?",
    body: "What reduces the settlement? The liability test cites contributory negligence, but I need the basis named in the rationale.",
    answer:
      "Contributory negligence on the claimant's own late braking, admitted at 25% by the third-party insurer's reconstruction. It reduces the general and special damages heads in the same proportion. Care and rehabilitation and treatment costs sit under their own limits, which is why those two lines are paid in full.",
  },
  {
    id: "cr-rebuild-cost-disputed",
    kind: "missing-context",
    label: "Claimant disputes the 25% share",
    body: "The claimant's solicitor puts contributory negligence at 10%, not 25%, which would change the apportionment.",
    answer:
      "That is worth resolving before this settles: the split is entirely a function of the contributory share, and a second reconstruction would change the numbers on this screen, not just the argument.",
    forOptions: ["PartialPlusGoodwill"],
  },
  {
    id: "cr-fire-not-covered",
    kind: "disagree",
    label: "The injury isn't fully established",
    body: "The discharge summary describes the disc protrusion as probable on imaging, not confirmed. That is not the same as ruling out a pre-existing degenerative change.",
    answer:
      "Taken as unconfirmed rather than established, the quantum position does not hold up on its own. A probable finding is usually enough to reserve a claim, but if you want certainty here, that is a further instruction for the independent medical examination before this settles.",
    forOptions: ["Denied"],
  },
  {
    id: "cr-waive-average",
    kind: "disagree",
    label: "Concede contributory negligence as a gesture",
    body: "This is a serious injury with a young family losing an income. Dropping the contributory reduction would be the right thing to do.",
    answer:
      "It would cost the reduction, £51,000.00, as a full concession rather than a gesture, and it is the kind of exception that is hard to explain the next time contributory negligence is correctly applied. If goodwill is warranted here, the care, rehabilitation and treatment lines already carry no reduction; a further gesture would need its own sign-off.",
    forOptions: ["Approved"],
  },
  {
    id: "cr-installer-negligence-open",
    kind: "disagree",
    label: "The long-term prognosis isn't established",
    body: "The persistent symptoms are on the record, but nobody has established that the injury is permanent. Flagging it without evidence reads as though we are already reserving for a permanent impairment.",
    answer:
      "You're right that it is still open. Nothing here reserves for permanence; it is recorded so that if a permanent impairment is later confirmed, the quantum assessment has the fact on file rather than starting from nothing.",
    forOptions: ["PartialPlusGoodwill", "Approved"],
  },
];

// ── The hero claim: CLAIM-5182 ──────────────────────────────────────────────

const CASE_0421: InjuryClaim = {
  id: "CLAIM-5182",
  instanceId: "",
  folderKey: "",
  customer: "Joseph Thompson",
  customerSegment: "Standard",
  standing: {
    annualValue: 780,
    renewalDate: "2026-11-02",
    slaCreditsYtd: 3200,
    creditTriggered: true,
    goodwill12mo: 0,
    contactName: "J. Thompson",
    contactRole: "Claimant",
    lastSpokenAt: daysAgo(2),
    lastSpokenVia: "Claims call centre",
    source: "Injury Policy Gateway",
  },
  site: "A38 Chester Road junction, Sutton Coldfield, West Midlands, B75 6QP",
  asset: {
    model: "Bodily Injury — Motor",
    serial: "ALD-PI-2023-0421",
    description: "Whiplash-associated disorder with L4/L5 disc protrusion — off work 14 weeks",
    inServiceMonths: 30,
    coverageStatus: "Active to 2026-11-02 · £500 excess",
    identityConfirmed: true,
  },
  priority: "P1",
  status: "Action required",
  currentStage: "Medical Evidence & Quantum Decision",
  activeLanes: [],
  owner: "Dana Ferris",
  ownerRole: "Claims Officer",
  description: "Road traffic injury: waiting on new medical information",
  queueReason: "Waiting on new medical information",
  claimValue: 219_900,
  lineStatus: "Unfit for work · certified",
  // The claimant has been off work 14 weeks; the claim reached us hours after
  // the accident, which is where this case starts.
  lineDownHours: 336,
  openedAt: daysAgo(14),
  lastUpdatedAt: minutesAgo(30),
  slaMinutes: 4 * 60,
  elapsedMinutes: 4 * 60 - 95,
  slaStatus: "At risk",
  stageStates: {
    s1: "completed",
    s2: "completed",
    s3: "completed",
    s4: "active",
    s5: "pending",
    s6: "pending",
    s7: "pending",
    s8: "pending",
  },
  evidence: [
    {
      id: "ev-0421-1",
      kind: "pdf",
      title: "Medical records bundle",
      verdict: "Injury confirmed · symptoms persisting beyond the initial prognosis",
      issuer: "Aldergate Personal Injury · Injury Assessment",
      reference: "MED-2026-08842",
      pages: 3,
      fileUrl: "documents/medical-records-bundle.pdf",
      body:
        "Records received 1 September 2026. The claimant was struck from behind at the A38 Chester Road junction and attended the emergency department the same morning. Imaging shows an L4/L5 disc protrusion alongside a whiplash-associated disorder of the cervical spine. Mechanism consistent with a rear-end collision. No indication of a pre-existing degenerative change on the available films.\n\nThe treating consultant certified the claimant unfit for work for an initial twelve weeks. Symptoms have now persisted past that mark and a further review has been requested, so the long-term prognosis is recorded as probable rather than confirmed. Updated records are outstanding and the case is referred to the claims officer.",
      extracted: [
        { label: "Records received", value: "1 September 2026", confidence: 99 },
        { label: "Primary diagnosis", value: "L4/L5 disc protrusion (probable)", confidence: 88 },
        { label: "Certified unfit for work", value: "12 weeks initial", confidence: 95 },
        { label: "Weeks off work to date", value: "14", confidence: 99 },
        {
          label: "Contributory share alleged",
          value: "25%",
          inferred: true,
          confidence: 97,
          source: "Third-party insurer's reconstruction, stated outright in its response so the derived value can be cross-checked.",
        },
        { label: "Further review requested", value: "Yes, 31 August 2026", confidence: 98 },
      ],
      addedAt: minutesAgo(6 * 60),
      addedBy: "Injury Assessment",
      helpful: true,
    },
    {
      id: "ev-0421-2",
      kind: "pdf",
      title: "Policy schedule extract",
      verdict: "Indemnity limits, excess and cover dates confirmed",
      issuer: "Aldergate Personal Injury",
      reference: "ALD-PI-2023-0421",
      pages: 2,
      fileUrl: "documents/policy-schedule-extract.pdf",
      body:
        "Personal injury indemnity limit £300,000. Legal costs limit £45,000. Excess £500. Care and rehabilitation limit £30,000. Damages are apportioned where contributory negligence is admitted or established at the time of settlement.",
      extracted: [
        { label: "Indemnity limit", value: "£300,000", source: "Section 1", confidence: 99 },
        { label: "Legal costs limit", value: "£45,000", source: "Section 2", confidence: 99 },
        { label: "Excess", value: "£500", confidence: 99 },
        { label: "Care and rehabilitation limit", value: "£30,000", confidence: 98 },
        { label: "Apportionment", value: "Applies to damages heads", source: "General Conditions", confidence: 98 },
      ],
      addedAt: minutesAgo(5 * 60 + 40),
      addedBy: "Injury Policy Gateway",
      helpful: true,
    },
    {
      id: "ev-0421-3",
      kind: "pdf",
      title: "Treatment and rehabilitation plan",
      verdict: "Treatment pathway and provider estimate",
      issuer: "Provider Network · Approved Rehabilitation Provider",
      reference: "TRP-2026-4471",
      pages: 3,
      fileUrl: "documents/treatment-and-rehabilitation-plan.pdf",
      body:
        "Structured pathway covering spinal physiotherapy, pain management, a graded return-to-work programme and an occupational health review. Estimate totals £182,400 before the loss-of-earnings and care lines.",
      table: {
        columns: ["Item", "Description", "Estimate"],
        rows: [
          ["Acute physiotherapy", "Cervical and lumbar spine, 14 weeks", "£8,200"],
          ["Pain management", "Consultant review and injection therapy", "£61,900"],
          ["Future care and treatment", "Ongoing therapy, aids, home support", "£74,300"],
          ["Graded return-to-work programme", "Occupational health, phased hours", "£38,000"],
        ],
      },
      extracted: [
        { label: "Provider", value: "Approved Rehabilitation Provider, Provider Network", confidence: 98 },
        { label: "Estimate total", value: "£182,400", confidence: 97 },
      ],
      addedAt: minutesAgo(5 * 60),
      addedBy: "Provider Network Gateway",
      helpful: true,
    },
    {
      id: "ev-0421-4",
      kind: "pdf",
      title: "Loss of earnings schedule",
      verdict: "Itemised wage loss, £24,500 claimed",
      issuer: "Joseph Thompson",
      reference: "As submitted",
      pages: 2,
      fileUrl: "documents/loss-of-earnings-schedule.pdf",
      body:
        "Itemised schedule of lost earnings across 14 certified weeks, with payslips, employer confirmation of normal hours, and the shift premiums and overtime the claimant would ordinarily have worked.",
      extracted: [
        { label: "Weeks claimed", value: "14", confidence: 99 },
        { label: "Total claimed", value: "£24,500", confidence: 96 },
      ],
      addedAt: minutesAgo(4 * 60 + 30),
      addedBy: "Claimant submission",
      helpful: true,
    },
    {
      id: "ev-0421-5",
      kind: "pdf",
      title: "Claim intake notification",
      verdict: "P1 · claimant hospitalised",
      issuer: "Aldergate Personal Injury · Claims Intake Centre",
      reference: "Captured to CLAIM-5182",
      pages: 1,
      fileUrl: "documents/claim-intake-notification.pdf",
      body:
        "First notification taken by phone the morning of the accident. Claimant confirmed admitted to hospital, ambulance and police attended the scene, third-party vehicle identified.",
      extracted: [
        { label: "Reported by", value: "J. Thompson", confidence: 99 },
        { label: "Reported", value: "31 August 2026, 07:12", confidence: 97 },
      ],
      addedAt: minutesAgo(13 * 60 + 30),
      addedBy: "Claims Intake Centre",
      helpful: null,
    },
    {
      id: "ev-0421-6",
      kind: "pdf",
      title: "Personal Injury Claims SOP v3",
      verdict: "Governs this decision",
      issuer: "Aldergate Personal Injury",
      reference: "SOP v3",
      pages: 3,
      fileUrl: "documents/personal-injury-claims-SOP-v3.pdf",
      body:
        "The internal procedure governing claims resolution: evidence requirements, authority thresholds, and the route each liability position takes, including when contributory negligence is applied.",
      extracted: [
        { label: "Applies to", value: "Claims resolution, all injury tiers", confidence: 97 },
        { label: "Version", value: "v3", confidence: 99 },
      ],
      addedAt: minutesAgo(4 * 60),
      addedBy: "Policy library",
      helpful: null,
    },
  ],
  trail: [
    {
      seq: 1,
      actor: "event",
      actorLabel: "EVT",
      step: "New medical information uploaded to the case",
      stage: "Medical Evidence & Quantum Decision",
      time: "09:14 AM",
    },
    {
      seq: 2,
      actor: "agent",
      actorLabel: "AG",
      step: "Case manager: checks the new records against the current assessment",
      stage: "Medical Evidence & Quantum Decision",
      time: "09:14 AM",
    },
    {
      seq: 3,
      actor: "agent",
      actorLabel: "AG",
      step: "Case manager: confirms the 75% apportionment, confidence high",
      stage: "Medical Evidence & Quantum Decision",
      time: "09:15 AM",
    },
    {
      seq: 4,
      actor: "human",
      actorLabel: "HT",
      step: "Dana confirms the medical position before quantum is finalised",
      stage: "Medical Evidence & Quantum Decision",
      time: "09:41 AM",
    },
  ],
  variables: {
    "Case.Id": "CLAIM-5182",
    "Policy.Id": "ALD-PI-2023-0421",
    "Liability.Position": "Admitted, 25% contributory",
    "Contributory.Share": "25%",
  },
  caseManagerMode: "hybrid",
  activity: [
    {
      id: "a-0421-1",
      category: "task",
      level: "stage",
      actor: "Case manager",
      title: "Claim created from a first notification",
      detail: "Joseph Thompson · A38 Chester Road junction, Sutton Coldfield",
      time: minutesAgo(13 * 60 + 40),
      stage: "Claim Intake & Registration",
    },
    {
      id: "a-0421-2",
      category: "task",
      level: "task",
      actor: "Automation",
      title: "Identify claimant and policy",
      detail: "ALD-PI-2023-0421 matched in the policy administration system",
      time: minutesAgo(13 * 60 + 34),
      stage: "Claim Intake & Registration",
    },
    {
      id: "a-0421-3",
      category: "human",
      level: "task",
      actor: "Tom Beckerman",
      title: "Classify injury severity",
      detail: "P1, claimant hospitalised, 13 hours and counting",
      time: minutesAgo(13 * 60 + 2),
      stage: "Claim Intake & Registration",
      hitl: [
        { kind: "assigned", actor: "Tom Beckerman", time: minutesAgo(13 * 60 + 30) },
        { kind: "completed", actor: "Tom Beckerman", time: minutesAgo(13 * 60 + 2) },
      ],
    },
    {
      id: "a-0421-4",
      category: "task",
      level: "stage",
      actor: "Case manager",
      title: "Injury track assigned and accepted",
      detail: "Aldergate Injury Assessment · serious injury track within 4 hours",
      time: minutesAgo(12 * 60),
      stage: "Injury Triage & Track Assignment",
    },
    {
      id: "a-0421-5",
      category: "rules",
      level: "stage",
      actor: "Case manager",
      title: "Entered Medical Evidence & Quantum Decision",
      detail: "Aldergate Claims Operations · 4 hr clock",
      time: minutesAgo(4 * 60 + 40),
      stage: "Medical Evidence & Quantum Decision",
    },
    {
      id: "a-0421-6",
      category: "task",
      level: "task",
      actor: "Automation",
      title: "Assemble medical and policy evidence",
      detail: "3 documents retrieved from the policy and provider network systems",
      time: minutesAgo(4 * 60 + 30),
      stage: "Medical Evidence & Quantum Decision",
    },
    {
      id: "a-0421-7",
      category: "agent",
      level: "task",
      actor: "Evidence agent",
      title: "Flag missing and conflicting facts",
      detail: "Symptoms persist past the certified prognosis, and no rule resolves the contributory split",
      time: minutesAgo(3 * 60 + 58),
      stage: "Medical Evidence & Quantum Decision",
    },
    {
      id: "a-0421-8",
      category: "ai",
      level: "milestone",
      actor: "Case manager",
      title: "Routed to a person for the liability and quantum position",
      detail: "Applying contributory negligence on a P1, hospitalised claimant sits inside the claims officer's delegated authority",
      time: minutesAgo(3 * 60 + 12),
      stage: "Medical Evidence & Quantum Decision",
      actionId: "coverage-decision",
    },
  ],
  comments: [
    {
      author: "Tom Beckerman",
      role: "Claims Administrator",
      time: minutesAgo(9 * 60),
      text: "Claimant confirmed admitted overnight, not just treated and discharged. Treating as P1 for the clock.",
    },
    {
      author: "Marcus Ibe",
      role: "Injury Assessor",
      time: minutesAgo(3 * 60 + 40),
      text: "The medical position is solid on what we have, but the twelve-week certificate has run out and symptoms haven't. Happy to revisit once the updated records land.",
    },
  ],
  isLive: false,
};

/**
 * A mid-case event, kept separate so the demo can fire it on demand rather
 * than showing the claim as already reassessed.
 *
 * Carries no case id on purpose: the button that fires it applies it to
 * whichever claim is open. A claim read from Maestro has a live id, and an
 * authored id here only invited the event to be filed against a claim nobody
 * is looking at.
 */
export const EVIDENCE_UPLOAD_EVENT = {
  document: {
    // Deliberately not in the ev-NNNN-N sequence: this document arrives at run
    // time, and a sequential id would collide the moment the authored set grows.
    id: "ev-upload-photos",
    kind: "pdf" as const,
    title: "updated-medical-records.pdf",
    verdict: "Updated medical records from the treating consultant",
    body:
      "Dana uploads the updated records the provider emailed her this morning. It behaves the same way new medical evidence does when it lands on a claim mid-case.",
    addedAt: minutesAgo(2),
    addedBy: "Dana Ferris (claims officer)",
    isNew: true,
    helpful: null,
  },
  reassessment: {
    trigger: "Updated medical records from the treating consultant",
    headline: "Quantum position may no longer hold",
    detail:
      "Nobody routed this. The upload event woke the case agent, which checked the new records against the current assessment and flagged that the injury may be more serious than first recorded.",
    confidence: "high" as const,
    recommendedOutcome:
      "Refer for an independent medical examination before the quantum position is finalized",
    evidenceBasis: ["Current quantum position", "Updated medical records", "Prognosis delta"],
  },
};

// ── The other two claims in the queue ───────────────────────────────────────

const CASE_0417: InjuryClaim = {
  id: "CLAIM-5170",
  instanceId: "",
  folderKey: "",
  customer: "Elena Marsh",
  customerSegment: "Preferred",
  standing: {
    annualValue: 612,
    renewalDate: "2027-03-14",
    slaCreditsYtd: 0,
    creditTriggered: true,
    goodwill12mo: 0,
    contactName: "E. Marsh",
    contactRole: "Claimant",
    lastSpokenAt: daysAgo(1),
    lastSpokenVia: "Claims call centre",
    source: "Injury Policy Gateway",
  },
  site: "Aldermoor Close junction, Solihull, West Midlands, B91 3QF",
  asset: {
    model: "Bodily Injury — Motor",
    serial: "ALD-PI-2024-0417",
    description: "Soft-tissue neck and shoulder injury — low-speed side impact, six weeks of physiotherapy",
    inServiceMonths: 18,
    coverageStatus: "Active to 2027-03-14 · £250 excess",
    identityConfirmed: true,
  },
  priority: "P2",
  status: "Action required",
  currentStage: "Quantum Assessment & Settlement Negotiation",
  activeLanes: [],
  owner: "Dana Ferris",
  ownerRole: "Claims Officer",
  description: "Soft-tissue injury: settlement ready for authorisation",
  queueReason: "Settlement ready for authorisation",
  claimValue: 27_400,
  openedAt: daysAgo(6),
  lastUpdatedAt: minutesAgo(40),
  slaMinutes: 4 * 60,
  elapsedMinutes: 2 * 60 + 10,
  slaStatus: "On track",
  stageStates: {
    s1: "completed",
    s2: "completed",
    s3: "completed",
    s4: "completed",
    s5: "completed",
    s6: "active",
    s7: "pending",
    s8: "pending",
  },
  evidence: [
    {
      id: "ev-0417-1",
      kind: "pdf",
      title: "Medical records bundle",
      verdict: "Soft-tissue injury confirmed · straightforward, liability admitted",
      issuer: "Aldergate Personal Injury · Injury Assessment",
      reference: "MED-2026-08511",
      pages: 3,
      fileUrl: "documents/medical-records-bundle.pdf",
      body:
        "Records received 12 September 2026. A low-speed side impact at a give-way junction produced a soft-tissue strain of the cervical spine and right shoulder. The claimant attended her GP the same day; no imaging indicated. Symptoms resolved on a six-week physiotherapy course. No indication of a pre-existing or degenerative contribution: the onset and recovery pattern are consistent with a single, sudden mechanism.",
      extracted: [
        { label: "Records received", value: "12 September 2026", confidence: 99 },
        { label: "Diagnosis", value: "Cervical and shoulder soft-tissue strain", confidence: 97 },
        { label: "Onset", value: "Sudden, not degenerative", inferred: true, confidence: 92, source: "Onset and recovery pattern read together; the records do not state this as a single line." },
        { label: "Treatment", value: "Six weeks physiotherapy, discharged", confidence: 98 },
      ],
      addedAt: minutesAgo(6 * 24 * 60),
      addedBy: "Injury Assessment",
      helpful: true,
    },
    {
      id: "ev-0417-2",
      kind: "pdf",
      title: "Policy schedule extract",
      verdict: "Indemnity limits, excess and cover dates confirmed",
      issuer: "Aldergate Personal Injury",
      reference: "ALD-PI-2024-0417",
      pages: 2,
      fileUrl: "documents/policy-schedule-extract.pdf",
      body:
        "Personal injury indemnity limit £340,000, legal costs limit £55,000, both well above the assessed quantum. Excess £250. Bodily injury from a motor accident is covered under Sections 1 and 2, subject to the pre-existing condition exclusion, which the medical records rule out.",
      extracted: [
        { label: "Indemnity limit", value: "£340,000", confidence: 99 },
        { label: "Legal costs limit", value: "£55,000", confidence: 99 },
        { label: "Excess", value: "£250", confidence: 99 },
        { label: "Bodily injury cover", value: "Yes, Sections 1 and 2", confidence: 98 },
      ],
      addedAt: minutesAgo(5 * 24 * 60 + 30),
      addedBy: "Injury Policy Gateway",
      helpful: true,
    },
    {
      id: "ev-0417-3",
      kind: "pdf",
      title: "Treatment and rehabilitation plan",
      verdict: "Treatment pathway and provider estimate",
      issuer: "Provider Network · Approved Rehabilitation Provider",
      reference: "TRP-2026-4402",
      pages: 2,
      fileUrl: "documents/treatment-and-rehabilitation-plan.pdf",
      body: "Six weeks of physiotherapy, a single occupational health review and a phased return to full hours. Estimate £15,800.",
      extracted: [
        { label: "Provider", value: "Approved Rehabilitation Provider, Provider Network", confidence: 98 },
        { label: "Estimate total", value: "£15,800", confidence: 97 },
      ],
      addedAt: minutesAgo(4 * 24 * 60),
      addedBy: "Provider Network Gateway",
      helpful: true,
    },
    {
      id: "ev-0417-4",
      kind: "pdf",
      title: "Loss of earnings schedule",
      verdict: "Three weeks of certified absence, £4,900",
      issuer: "Elena Marsh",
      reference: "As submitted",
      pages: 1,
      fileUrl: "documents/loss-of-earnings-schedule.pdf",
      body: "Three certified weeks of absence and a period of reduced hours, itemised with payslips.",
      extracted: [
        { label: "Periods claimed", value: "3", confidence: 99 },
        { label: "Total claimed", value: "£4,900", confidence: 96 },
      ],
      addedAt: minutesAgo(4 * 24 * 60),
      addedBy: "Claimant submission",
      helpful: true,
    },
    {
      id: "ev-0417-5",
      kind: "pdf",
      title: "Discharge and fitness-for-work certificate",
      verdict: "Treatment complete, claimant certified fit for full duties",
      issuer: "Provider Network · Occupational Health",
      reference: "OH-2026-1187",
      pages: 2,
      fileUrl: "documents/discharge-and-fitness-for-work-certificate.pdf",
      body:
        "Physiotherapy started 13 September, discharged 20 October. Final range-of-motion and pain scores are within the normal range for the claimant's age and occupation, certifying her fit for full duties and clearing the claim for quantum assessment.",
      extracted: [
        { label: "Treatment period", value: "13 September – 20 October 2026", confidence: 99 },
        { label: "Final assessment", value: "Within normal range", confidence: 97 },
      ],
      addedAt: minutesAgo(2 * 24 * 60),
      addedBy: "Provider Network Gateway",
      helpful: true,
    },
    {
      id: "ev-0417-6",
      kind: "pdf",
      title: "Claim intake notification",
      verdict: "P2 · treated and discharged same day",
      issuer: "Aldergate Personal Injury · Claims Intake Centre",
      reference: "Captured to CLAIM-5170",
      pages: 1,
      fileUrl: "documents/claim-intake-notification.pdf",
      body: "First notification taken by phone. Claimant had already seen her GP before calling.",
      extracted: [
        { label: "Reported by", value: "E. Marsh", confidence: 99 },
        { label: "Reported", value: "12 September 2026, 08:05", confidence: 97 },
      ],
      addedAt: minutesAgo(6 * 24 * 60 + 15),
      addedBy: "Claims Intake Centre",
      helpful: null,
    },
    {
      id: "ev-0417-7",
      kind: "pdf",
      title: "Personal Injury Claims SOP v3",
      verdict: "Governs this decision",
      issuer: "Aldergate Personal Injury",
      reference: "SOP v3",
      pages: 3,
      fileUrl: "documents/personal-injury-claims-SOP-v3.pdf",
      body:
        "The internal procedure governing claims resolution: evidence requirements, authority thresholds, and the route each liability position takes.",
      extracted: [
        { label: "Applies to", value: "Claims resolution, all injury tiers", confidence: 97 },
        { label: "Version", value: "v3", confidence: 99 },
      ],
      addedAt: minutesAgo(3 * 24 * 60),
      addedBy: "Policy library",
      helpful: null,
    },
  ],
  trail: [
    {
      seq: 1,
      actor: "process",
      actorLabel: "PR",
      step: "Fitness-for-work certificate received, decision clock resumed",
      stage: "Rehabilitation & Return-to-Work",
      time: "09:02 AM",
    },
    {
      seq: 2,
      actor: "agent",
      actorLabel: "AG",
      step: "Case manager: builds comparable settlement options, confidence high",
      stage: "Quantum Assessment & Settlement Negotiation",
      time: "09:10 AM",
    },
    {
      seq: 3,
      actor: "agent",
      actorLabel: "AG",
      step: "Case manager: settlement within the claims officer's delegated authority",
      stage: "Quantum Assessment & Settlement Negotiation",
      time: "09:11 AM",
    },
  ],
  variables: {
    "Case.Id": "CLAIM-5170",
    "Policy.Id": "ALD-PI-2024-0417",
    "Liability.Position": "Admitted in full",
    "Authority.Limit": "£35,000.00",
  },
  caseManagerMode: "hybrid",
  activity: [
    {
      id: "a-0417-1",
      category: "task",
      level: "stage",
      actor: "Case manager",
      title: "Claim created from a first notification",
      detail: "Elena Marsh · Aldermoor Close junction, Solihull",
      time: minutesAgo(6 * 24 * 60 + 20),
      stage: "Claim Intake & Registration",
    },
    {
      id: "a-0417-2",
      category: "task",
      level: "task",
      actor: "Automation",
      title: "Identify claimant and policy",
      detail: "ALD-PI-2024-0417 matched in the policy administration system",
      time: minutesAgo(6 * 24 * 60 + 10),
      stage: "Claim Intake & Registration",
    },
    {
      id: "a-0417-3",
      category: "rules",
      level: "stage",
      actor: "Case manager",
      title: "Injury track assigned and accepted",
      detail: "Aldergate Injury Assessment · minor injury track within 24 hours",
      time: minutesAgo(6 * 24 * 60),
      stage: "Injury Triage & Track Assignment",
    },
    {
      id: "a-0417-4",
      category: "rules",
      level: "stage",
      actor: "Case manager",
      title: "Entered Medical Evidence & Quantum Decision",
      detail: "Aldergate Claims Operations · 4 hr clock",
      time: minutesAgo(5 * 24 * 60 + 40),
      stage: "Medical Evidence & Quantum Decision",
    },
    {
      id: "a-0417-5",
      category: "ai",
      level: "milestone",
      actor: "Case manager",
      title: "Liability admitted in full, no dispute",
      detail: "Sudden soft-tissue injury, no pre-existing condition exclusion engaged, within indemnity limits",
      time: minutesAgo(5 * 24 * 60),
      stage: "Medical Evidence & Quantum Decision",
    },
    {
      id: "a-0417-6",
      category: "rules",
      level: "stage",
      actor: "Case manager",
      title: "Entered Rehabilitation & Return-to-Work",
      detail: "Provider Network · rehabilitation provider engaged",
      time: minutesAgo(4 * 24 * 60),
      stage: "Rehabilitation & Return-to-Work",
    },
    {
      id: "a-0417-7",
      category: "task",
      level: "task",
      actor: "Automation",
      title: "Fitness-for-work certificate received",
      detail: "Final assessment within normal range, claimant cleared for quantum assessment",
      time: minutesAgo(2 * 24 * 60),
      stage: "Rehabilitation & Return-to-Work",
    },
    {
      id: "a-0417-8",
      category: "rules",
      level: "stage",
      actor: "Case manager",
      title: "Entered Quantum Assessment & Settlement Negotiation",
      detail: "Aldergate Claims Operations · 4 hr clock",
      time: minutesAgo(2 * 60 + 10),
      stage: "Quantum Assessment & Settlement Negotiation",
    },
    {
      id: "a-0417-9",
      category: "ai",
      level: "milestone",
      actor: "Case manager",
      title: "Routed to a person for settlement authorisation",
      detail: "£27,400.00 sits within the claims officer's £35,000.00 delegated authority, no dispute to resolve",
      time: minutesAgo(2 * 60),
      stage: "Quantum Assessment & Settlement Negotiation",
      actionId: "settlement-authorisation",
    },
  ],
  comments: [
    {
      author: "Marcus Ibe",
      role: "Injury Assessor",
      time: minutesAgo(5 * 24 * 60),
      text: "Straightforward one. Low-speed impact, treated same day, no sign of anything pre-existing. Happy to sign off the quantum as assessed.",
    },
  ],
  isLive: false,
};

const CASE_0409: InjuryClaim = {
  id: "CLAIM-5164",
  instanceId: "",
  folderKey: "",
  customer: "Priti Sandhu",
  site: "Windmill Fields roundabout, Norwich, Norfolk, NR4 7TE",
  asset: {
    model: "Bodily Injury — Motor",
    serial: "ALD-PI-2022-0409",
    description: "Wrist fracture with suspected complex regional pain syndrome — condition deteriorating",
    inServiceMonths: 40,
    coverageStatus: "Active to 2027-01-11 · £500 excess",
  },
  priority: "P2",
  status: "Action required",
  currentStage: "Liability Assessment & Admission",
  activeLanes: ["Condition Deterioration & Re-assessment"],
  owner: "Marcus Ibe",
  ownerRole: "Injury Assessor",
  description: "Condition deteriorating: treatment plan exceeds the assessed track",
  queueReason: "Treatment exceeds the assessed track",
  claimValue: 18_600,
  lineStatus: "Working, restricted duties",
  openedAt: daysAgo(3),
  lastUpdatedAt: minutesAgo(70),
  slaMinutes: 4 * 60,
  elapsedMinutes: 2 * 60 + 20,
  slaStatus: "On track",
  stageStates: {
    s1: "completed",
    s2: "completed",
    s3: "active",
    s4: "pending",
    s5: "pending",
    s6: "pending",
    s7: "pending",
    s8: "pending",
    sx2: "active",
  },
  evidence: [
    {
      id: "ev-0409-1",
      kind: "pdf",
      title: "Treatment and rehabilitation plan",
      verdict: "Exceeds the assessed minor injury track",
      issuer: "Provider Network · Approved Pain Management Service",
      reference: "TRP-2026-4290",
      pages: 2,
      fileUrl: "documents/treatment-and-rehabilitation-plan.pdf",
      body:
        "The claimant sustained a distal radius fracture that was expected to resolve on a standard six-week pathway. Symptoms have instead worsened, and the treating team now suspects complex regional pain syndrome. The proposed plan replaces the standard pathway with a specialist pain management programme not on the assessed minor injury track. Clinical equivalence has not been established, so BR-006 sends it to an independent medical examination before a track can be confirmed.",
      addedAt: minutesAgo(140),
      addedBy: "Provider Network Gateway",
      helpful: null,
    },
  ],
  trail: [
    {
      seq: 1,
      actor: "human",
      actorLabel: "HT",
      step: "Injury assessor records treatment beyond the assessed track",
      stage: "Liability Assessment & Admission",
      time: "11:04 AM",
    },
    {
      seq: 2,
      actor: "agent",
      actorLabel: "AG",
      step: "Case manager: routes to Condition Deterioration & Re-assessment, confidence high",
      stage: "Liability Assessment & Admission",
      time: "11:05 AM",
    },
  ],
  variables: {
    "Case.Id": "CLAIM-5164",
    "Policy.Id": "ALD-PI-2022-0409",
    "Liability.Position": "Admitted",
    "Injury.Track": "Minor — under re-assessment",
  },
  caseManagerMode: "hybrid",
  activity: [
    {
      id: "a-0409-1",
      category: "rules",
      level: "stage",
      actor: "Case manager",
      title: "Entered Liability Assessment & Admission",
      detail: "Injury Assessment · 2 hr early-intervention recommendation",
      time: minutesAgo(6 * 60),
      stage: "Liability Assessment & Admission",
    },
    {
      id: "a-0409-2",
      category: "human",
      level: "task",
      actor: "Injury Assessment",
      title: "Establish liability and injury track",
      detail: "The proposed pain management programme exceeds the assessed minor injury track",
      time: minutesAgo(140),
      stage: "Liability Assessment & Admission",
      hitl: [
        { kind: "assigned", actor: "Marcus Ibe", time: minutesAgo(5 * 60) },
        { kind: "completed", actor: "Marcus Ibe", time: minutesAgo(140) },
      ],
    },
    {
      id: "a-0409-3",
      category: "ai",
      level: "milestone",
      actor: "Case manager",
      title: "Routed to Condition Deterioration & Re-assessment",
      detail: "Clinical equivalence not established. BR-006 reserves the judgement for an independent medical examination",
      time: minutesAgo(138),
      stage: "Liability Assessment & Admission",
      actionId: "engineering-exception",
    },
  ],
  comments: [],
  isLive: false,
};

// ── The 38 claims progressing on their own ──────────────────────────────────

const CUSTOMERS: { name: string; address: string }[] = [
  { name: "Naomi Castellano", address: "Foxglove Way junction, Reading, Berkshire" },
  { name: "Oliver Bramwell", address: "Kestrel Drive roundabout, Leicester, Leicestershire" },
  { name: "Anya Fernsby", address: "Larchwood Grove crossing, York, North Yorkshire" },
  { name: "Declan McAuley", address: "Orchard Rise, Belfast, County Antrim" },
  { name: "Freya Lindqvist", address: "Millbrook Terrace, Aberdeen, Aberdeenshire" },
  { name: "Samuel Etherington", address: "Cavendish Row, Bath, Somerset" },
  { name: "Ines Palacios", address: "Sycamore Close junction, Cardiff, South Wales" },
  { name: "Wesley Okonkwo-Ade", address: "Havenfield Road, Preston, Lancashire" },
  { name: "Marguerite Solano", address: "Thistledown Lane, Exeter, Devon" },
  { name: "Callum Nesbitt", address: "Grovehill Avenue, Dundee, Angus" },
];

const COVER_ITEMS = [
  { model: "Bodily Injury — Motor", description: "Whiplash-associated disorder, cervical spine" },
  { model: "Bodily Injury — Motor", description: "Rib fractures and chest wall bruising" },
  { model: "Bodily Injury — Public Liability", description: "Ankle fracture from a trip on an uneven pavement" },
  { model: "Bodily Injury — Motor", description: "Knee ligament injury, front-seat passenger" },
  { model: "Bodily Injury — Employers Liability", description: "Lower back strain from manual handling" },
  { model: "Bodily Injury — Public Liability", description: "Head injury from a falling display unit" },
  { model: "Bodily Injury — Motor", description: "Shoulder soft-tissue injury, cyclist" },
  { model: "Bodily Injury — Employers Liability", description: "Hand laceration and tendon damage" },
];

const OWNERS: { name: string; role: string }[] = [
  { name: "Dana Ferris", role: "Claims Officer" },
  { name: "Priya Nakamura", role: "Claims Manager" },
  { name: "Marcus Ibe", role: "Injury Assessor" },
  { name: "Renata Cole", role: "SIU Investigator" },
  { name: "Bethany Okwuosa", role: "Recovery Specialist" },
];

const PRIORITIES: Priority[] = ["P1", "P2", "P3", "P3", "P4"];

/** FNV-1a, a stable pseudo-random source so every render draws the same list. */
function seed(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return Math.abs(h);
}

const DESCRIPTIONS = [
  "Whiplash-associated disorder, rear-end collision",
  "Rib fractures, seat-belt restraint injury",
  "Ankle fracture from a trip on an uneven pavement",
  "Knee ligament injury, front-seat passenger",
  "Lower back strain from manual handling at work",
  "Head injury from a falling display unit",
  "Shoulder soft-tissue injury, cyclist struck at a junction",
  "Hand laceration and tendon damage, machine guard failure",
  "Pattern of claims flagged for SIU review",
  "Late-notified injury, treatment records outstanding",
];

const WAITING_REASONS = [
  "Awaiting claimant's medical records",
  "Treatment booked, awaiting provider availability",
  "Awaiting IME appointment confirmation",
  "Awaiting third-party insurer's liability response",
];

function buildBackgroundCase(index: number): InjuryClaim {
  const id = `CLAIM-${5200 + index}`;
  const s = seed(id);
  const customer = CUSTOMERS[s % CUSTOMERS.length];
  const item = COVER_ITEMS[(s >> 5) % COVER_ITEMS.length];
  const owner = OWNERS[(s >> 7) % OWNERS.length];
  const stageIdx = (s >> 9) % PRIMARY_STAGES.length;
  const stage = PRIMARY_STAGES[stageIdx];

  // A third of the background claims are blocked on somebody outside the team;
  // the rest are genuinely moving on their own.
  const waiting = s % 3 === 0;
  const priority = PRIORITIES[(s >> 11) % PRIORITIES.length];

  const stageStates: Record<string, StageState> = {};
  PRIMARY_STAGES.forEach((st, i) => {
    stageStates[st.id] = i < stageIdx ? "completed" : i === stageIdx ? "active" : "pending";
  });

  const slaMinutes = stage.slaMinutes ?? 24 * 60;
  // Spread elapsed time across the SLA band so a handful land at risk.
  const elapsedMinutes = Math.round((slaMinutes * ((s >> 13) % 95)) / 100);
  const slaStatus =
    elapsedMinutes >= slaMinutes
      ? "Breached"
      : elapsedMinutes / slaMinutes >= 0.75
        ? "At risk"
        : "On track";

  return {
    id,
    instanceId: "",
    folderKey: "",
    customer: customer.name,
    site: customer.address,
    asset: {
      model: item.model,
      serial: `ALD-${1000 + (s % 8999)}-${100 + ((s >> 4) % 899)}`,
      description: item.description,
      inServiceMonths: 3 + (s % 60),
      coverageStatus: "Active",
    },
    priority,
    status: waiting ? "Waiting on others" : "Progressing",
    currentStage: stage.name,
    activeLanes: waiting && s % 6 === 0 ? ["Complaint & Ombudsman Referral"] : [],
    owner: owner.name,
    ownerRole: owner.role,
    description: DESCRIPTIONS[(s >> 17) % DESCRIPTIONS.length],
    queueReason: undefined,
    claimValue: 800 + (s % 42) * 620,
    openedAt: daysAgo(1 + (s % 14)),
    lastUpdatedAt: minutesAgo(15 + (s % 900)),
    slaMinutes,
    elapsedMinutes,
    slaStatus,
    stageStates,
    evidence: [],
    trail: [
      {
        seq: 1,
        actor: "process",
        actorLabel: "PR",
        step: "Create and correlate claim record",
        stage: "Claim Intake & Registration",
        time: "",
      },
      {
        seq: 2,
        actor: "agent",
        actorLabel: "AG",
        step: waiting
          ? `Case manager: holding, ${WAITING_REASONS[(s >> 19) % WAITING_REASONS.length]}`
          : `Case manager: advanced to ${stage.name}`,
        stage: stage.name,
        time: "",
      },
    ],
    variables: {
      "Case.Id": id,
      "Policy.Id": `ALD-${item.model.split(" ")[0]}-${id.slice(-4)}`,
      "Liability.Position": stageIdx >= 3 ? "Admitted" : "Pending",
      "Recovery.Flag": s % 3,
    },
    // Left empty on purpose: `activityFor` derives a stage-and-task spine from
    // the stage states, so 38 rows do not need 38 hand-written feeds.
    activity: [],
    comments: [],
    caseManagerMode: "hybrid",
    isLive: false,
  };
}

const BACKGROUND_CASES = Array.from({ length: 38 }, (_, i) => buildBackgroundCase(i));

/** 41 open claims: 3 that need a person today, 38 progressing on their own. */
export const DEMO_CASES: InjuryClaim[] = [CASE_0417, CASE_0421, CASE_0409, ...BACKGROUND_CASES];

// ── Open human tasks ────────────────────────────────────────────────────────

export const DEMO_ACTIONS: CaseAction[] = [
  {
    id: "settlement-authorisation",
    caseId: "CLAIM-5170",
    actionType: "settlement-authorisation",
    title: "Authorise settlement: soft-tissue injury",
    stage: "Quantum Assessment & Settlement Negotiation",
    assignee: "Dana Ferris",
    priority: "P2",
    blocking: true,
    dueAt: minutesFromNow(4 * 60 - 130),
    slaMinutes: 4 * 60,
    elapsedMinutes: 2 * 60 + 10,
    whyThisReachedYou:
      "A straightforward soft-tissue claim: low-speed impact, liability admitted in full, indemnity limits ample, no exclusion engaged. £27,400.00 sits within your £35,000.00 delegated authority, so this is ready for sign-off rather than a liability dispute.",
    options: [
      {
        outcome: "Approved",
        label: "Approve settlement in full",
        rationale: "Liability, medical evidence and quantum all check out. Nothing here needs a second opinion.",
        supported: true,
      },
      {
        outcome: "EvidenceRequested",
        label: "Request further evidence",
        rationale: "Supported if any head of damage needs a second opinion before payment.",
        supported: true,
      },
      {
        outcome: "Denied",
        label: "Decline settlement",
        rationale: "Not supported: liability, cover and the medical evidence are all in order.",
        supported: false,
      },
    ],
    recommendation: {
      headline: "Approve settlement in full",
      detail:
        "The medical records, the fitness-for-work certificate and the treatment plan agree: a sudden soft-tissue injury, liability admitted, quantum assessed at the guideline bracket. £27,400.00 is within your delegated authority.",
      confidence: "high",
      recommendedOutcome: "Approved",
      evidenceBasis: ["Medical records bundle", "Discharge and fitness-for-work certificate", "Treatment and rehabilitation plan"],
    },
    confidencePercent: 96,
    precedent: "94% agree",
    peerContext: "Across comparable soft-tissue claims within authority, 94% were approved as recommended.",
    claimTotal: 27_400,
    claimLineSummary: "4 lines · general damages, loss of earnings, treatment, excess applied",
    tiles: [
      { label: "Claim value", value: "£27,400", note: "Within £35,000 authority", tone: "clock" },
      { label: "Decision due", value: "1h 50m", note: "Not blocking · low risk", tone: "clock" },
    ],
    status: "Open",
  },
  {
    id: "coverage-decision",
    caseId: "CLAIM-5182",
    actionType: "coverage-decision",
    title: "Liability and quantum: new medical information",
    stage: "Medical Evidence & Quantum Decision",
    assignee: "Dana Ferris",
    priority: "P1",
    blocking: true,
    dueAt: minutesFromNow(95),
    slaMinutes: 4 * 60,
    elapsedMinutes: 4 * 60 - 95,
    whyThisReachedYou:
      "The injury is established and covered. The third-party insurer admits primary liability but alleges 25% contributory negligence for late braking, so damages settle at 75%. No rule in the case plan decides how much of the care, rehabilitation and treatment lines sits outside that reduction, and the updated medical records are still outstanding, which is why this is with a person.",
    options: [
      {
        outcome: "Denied",
        label: "Deny liability",
        rationale: "The claimant funds their own treatment and losses. A written reason is required.",
        supported: false,
        allocation: {
          "buildings-covered": { to: "customer", why: "Not covered" },
          "buildings-shortfall": { to: "customer", why: "Not covered" },
          "contents-covered": { to: "customer", why: "Not covered" },
          "contents-shortfall": { to: "customer", why: "Not covered" },
          ale: { to: "customer", why: "Not covered" },
          debris: { to: "customer", why: "Not covered" },
        },
        draftRationale: "",
        overrideNote: "A denial requires a written reason the claimant will see. Please record it.",
        effects: [
          { title: "Liability position written to the Injury Claims Gateway", detail: "denied" },
          { title: "No reserve raised", detail: "£0" },
          { title: "Adverse decision letter drafted, Head of Claims sign-off required", hold: true },
          { title: "Provider Network treatment authorisation held", hold: true },
          { title: "Decision written to the ledger", detail: "override of the recommendation" },
        ],
      },
      {
        outcome: "Approved",
        label: "Settle in full, concede contributory negligence",
        rationale: "Aldergate meets the damages in full, conceding the alleged contributory reduction.",
        supported: false,
        allocation: {
          "buildings-covered": { to: "vendor", why: "Met in full" },
          "buildings-shortfall": { to: "vendor", why: "Contributory reduction conceded", goodwill: true },
          "contents-covered": { to: "vendor", why: "Met in full" },
          "contents-shortfall": { to: "vendor", why: "Contributory reduction conceded", goodwill: true },
          ale: { to: "vendor", why: "Met in full" },
          debris: { to: "vendor", why: "Met in full" },
        },
        draftRationale: "",
        overrideNote: "Conceding contributory negligence costs the full £51,000.00 reduction as goodwill. Please record why.",
        effects: [
          { title: "Liability position written to the Injury Claims Gateway", detail: "admitted in full" },
          { title: "Reserve raised", detail: "£219,900.00" },
          { title: "Routed to D. Whitfield-Nkemelu for co-approval", hold: true },
          { title: "Provider Network treatment authorisation held pending co-approval", hold: true },
          { title: "Decision written to the ledger", detail: "override of the recommendation" },
        ],
      },
      {
        outcome: "PartialPlusGoodwill",
        label: "Settle, contributory negligence applied",
        rationale: "Splits the damages at the 75% apportionment, meets care, rehabilitation and treatment in full.",
        supported: true,
        allocation: {
          "buildings-covered": { to: "vendor", why: "Met at the 75% apportionment" },
          "buildings-shortfall": { to: "customer", why: "Contributory negligence reduction" },
          "contents-covered": { to: "vendor", why: "Met at the 75% apportionment" },
          "contents-shortfall": { to: "customer", why: "Contributory negligence reduction" },
          ale: { to: "vendor", why: "Not subject to apportionment, separate limit" },
          debris: { to: "vendor", why: "Not subject to apportionment, separate limit" },
        },
        draftRationale:
          "The injury is established and covered; the accident itself is not in question. The third-party insurer admits primary liability but alleges the claimant braked late, and its reconstruction puts the claimant's share at 25%. General and special damages therefore settle at 75% and the claimant bears the remaining 25%. Care and rehabilitation costs and medical treatment costs sit under their own limits, outside the apportionment, and are met in full given the confirmed 14 weeks of certified absence. The long-term prognosis is unestablished pending the updated medical records and has not been weighed against the claimant.",
        effects: [
          { title: "Liability position written to the Injury Claims Gateway", detail: "admitted at 75%, with rationale" },
          { title: "Reserve raised", detail: "£168,900.00" },
          { title: "Claimant notification drafted", detail: "owner: Dana Ferris" },
          { title: "Provider Network treatment authorisation released", detail: "rehabilitation proceeds" },
          { title: "Decision written to the ledger", detail: "proposed and decided agree" },
        ],
      },
    ],
    recommendation: {
      headline: "Settle, contributory negligence applied",
      detail:
        "The injury is covered and not in dispute. The claimant is assessed at 25% contributory, so the apportionment reduces the general and special damages heads to 75%. Care, rehabilitation and treatment costs sit outside the apportionment and are met in full.",
      confidence: "high",
      recommendedOutcome: "PartialPlusGoodwill",
      evidenceBasis: ["Medical records bundle", "Policy schedule extract", "Treatment and rehabilitation plan"],
    },
    confidencePercent: 91,
    precedent: "70% agree",
    precedentBreakdown: PRECEDENT_0421,
    precedentBasis: "Last 18 months · contributory negligence, rear-end collision",
    signals: SIGNALS_0421,
    replies: REPLIES_0421,
    peerContext: "Across similar contributory negligence claims, 70% ended in the apportionment applied as assessed.",
    claimTotal: 219_900,
    claimLineSummary: "6 lines · general damages, special damages, care and rehabilitation, treatment",
    tiles: [
      { label: "Time off work", value: "14 weeks", note: "Certified unfit · graded return pending", tone: "alarm" },
      { label: "Decision due", value: "1h 35m", note: "15:46 BST · blocking", tone: "clock" },
    ],
    causes: [
      {
        side: "covered",
        label: "Finding 1",
        title: "Injury established, accident inside policy term",
        body:
          "Rear-end collision at the A38 Chester Road junction, producing a whiplash-associated disorder and an L4/L5 disc protrusion. Police report and dashcam footage corroborate the circumstances. Cover is in force with no relevant exclusion engaged.",
        summary: "Accidental injury · fully covered before apportionment",
        points: "Points to covered",
        established: "ESTABLISHED 09-01 ON RECORDS",
        sources: ["Injury Severity Data Gateway", "Injury Claims Gateway"],
      },
      {
        side: "excluded",
        label: "Finding 2",
        title: "Contributory negligence, late braking",
        body:
          "The third-party insurer admits primary liability but alleges the claimant braked late, and its reconstruction puts the claimant's share at 25%. The general and special damages heads reduce in the same proportion; the remaining 25% is not recoverable.",
        summary: "75% apportionment · reduction not recoverable",
        points: "Points to excluded",
        established: "ASSESSED 09-01, THIRD-PARTY RECONSTRUCTION",
        sources: ["Injury Severity Data Gateway", "Injury Policy Gateway"],
      },
    ],
    verdict: {
      headline: "The apportionment applies to general and special damages only.",
      detail:
        "Each holds up on its own evidence: the injury is covered, and the contributory share is an apportionment of liability rather than a denial. The two combine to set the settlement at 75% of the damages heads, with care, rehabilitation and treatment unaffected.",
    },
    costLines: [
      { id: "buildings-covered", name: "General damages — assessed portion", amount: 135_000 },
      { id: "buildings-shortfall", name: "General damages — contributory negligence reduction", amount: 45_000 },
      { id: "contents-covered", name: "Special damages — assessed portion", amount: 18_000 },
      { id: "contents-shortfall", name: "Special damages — contributory negligence reduction", amount: 6_000 },
      { id: "ale", name: "Care and rehabilitation costs", amount: 9_800 },
      { id: "debris", name: "Medical and treatment costs", amount: 6_100 },
    ],
    authority: {
      limit: 200_000,
      approver: "D. Whitfield-Nkemelu, Head of Claims",
    },
    folds: [
      {
        id: "coverage-basis",
        label: "Cover basis",
        summary: "Policy active to 2026-11-02 · £500 excess",
        body: "Bodily Injury — Motor ALD-PI-2023-0421, active to 2026-11-02, £500.00 excess. Claimant identity confirmed against the policy schedule and the police report: Joseph Thompson, A38 Chester Road junction, Sutton Coldfield.",
      },
      {
        id: "policy-test",
        label: "Claim test: ALD-PI-2023-0421",
        summary: "7 checks · 5 pass, 1 fail, 1 open",
        marked: 3,
        checks: POLICY_CHECKS_0421,
      },
      {
        id: "claim-as-filed",
        label: "Claim as filed",
        summary: "4 lines · £219,900.00",
        body: "General damages £182,400.00 · Loss of earnings £24,500.00 · Care and rehabilitation £9,800.00 · Medical and treatment costs £6,100.00.",
      },
      {
        id: "sum-insured-history",
        label: "Liability history",
        summary: "Primary liability admitted, 25% contributory alleged",
        marked: 1,
        body: "The third-party insurer admitted primary liability within nine days of notification and has not resiled from it. The 25% contributory allegation rests on its own reconstruction of the claimant's braking distance, which the claimant's solicitor has not yet answered.",
      },
      {
        id: "policyholder-standing",
        label: "Claimant standing",
        summary: "Standard · £780/yr premium · 14 weeks off work",
        marked: 2,
        body: "Standard-tier policyholder, £780.00 annual premium. This is the claimant's first injury claim in three years on risk. The 14-week absence is the longest on this policy.",
      },
      {
        id: "timeline",
        label: "Timeline",
        summary: "7 events · notification to decision-ready in 3 hr 58 min",
        body: "07:12 accident reported · 07:40 claim created · 08:20 claimant identified · 09:02 severity classified P1 · 10:14 medical records requested · 13:12 evidence assembled · 15:58 decision-ready.",
      },
    ],
    effects: [
      { title: "Liability position written to the Injury Claims Gateway", detail: "admitted at 75%, with rationale" },
      { title: "Reserve raised", detail: "£168,900.00" },
      { title: "Claimant notification drafted", detail: "owner: Dana Ferris" },
      { title: "Provider Network treatment authorisation released", detail: "rehabilitation proceeds" },
      { title: "Decision written to the ledger", detail: "proposed and decided agree" },
    ],
    draftRationale:
      "The injury is established and covered; the accident itself is not in question. The third-party insurer admits primary liability but alleges the claimant braked late, and its reconstruction puts the claimant's share at 25%. General and special damages therefore settle at 75% and the claimant bears the remaining 25%. Care and rehabilitation costs and medical treatment costs sit under their own limits, outside the apportionment, and are met in full given the confirmed 14 weeks of certified absence. The long-term prognosis is unestablished pending the updated medical records and has not been weighed against the claimant.",
    status: "Open",
    rationale:
      "The injury is established and covered; the accident itself is not in question. The third-party insurer admits primary liability but alleges the claimant braked late, and its reconstruction puts the claimant's share at 25%. General and special damages therefore settle at 75% and the claimant bears the remaining 25%. Care and rehabilitation costs and medical treatment costs sit under their own limits, outside the apportionment, and are met in full given the confirmed 14 weeks of certified absence. The long-term prognosis is unestablished pending the updated medical records and has not been weighed against the claimant.",
  },
  {
    id: "engineering-exception",
    caseId: "CLAIM-5164",
    actionType: "engineering-exception",
    title: "Review condition and treatment constraints",
    stage: "Condition Deterioration & Re-assessment",
    assignee: "Marcus Ibe",
    priority: "P2",
    blocking: true,
    dueAt: minutesFromNow(100),
    slaMinutes: 4 * 60,
    elapsedMinutes: 2 * 60 + 20,
    whyThisReachedYou:
      "The proposed treatment replaces the standard fracture pathway with a specialist pain management programme that is not on the assessed minor injury track. Clinical equivalence has not been established, so the medical judgement sits with an independent medical examination before a track can be confirmed.",
    options: [
      {
        outcome: "Approved",
        label: "Approve for resolution",
        rationale: "Supported once clinical equivalence is met. The specialist programme covers the standard pathway and more.",
        supported: true,
      },
      {
        outcome: "ReturnForDiagnosis",
        label: "Return for further medical evidence",
        rationale: "Supported if the extent of the deterioration is judged unconfirmed from the current records.",
        supported: true,
      },
      {
        outcome: "ControlledEscalation",
        label: "Raise controlled escalation",
        rationale: "Not supported: nothing here reaches the litigation or authority threshold.",
        supported: false,
      },
    ],
    recommendation: {
      headline: "Approve for resolution",
      detail:
        "The specialist pain management programme covers everything the standard pathway does, and there is an equivalence record from comparable deteriorating-fracture claims already settled.",
      confidence: "medium",
      recommendedOutcome: "Approved",
      evidenceBasis: ["Treatment and rehabilitation plan"],
    },
    status: "Open",
  },
];

// ── Fleet-level numbers ─────────────────────────────────────────────────────

export const DEMO_INSIGHTS: OperationalInsights = {
  autonomousRate: 93,
  interventionRate: 7,
  atSlaRisk: 4,
  bottleneckStage: "Medical Evidence & Quantum Decision",
  bottleneckLabel: "Medical evidence review",
  // The point of this chart is that fewer claims ENTER the queue, not that the
  // queue drains faster. Entered falls while completed stays roughly flat.
  queueEntryTrend: [
    { period: "Mar", entered: 41, completed: 38 },
    { period: "Apr", entered: 36, completed: 37 },
    { period: "May", entered: 29, completed: 31 },
    { period: "Jun", entered: 22, completed: 24 },
    { period: "Jul", entered: 15, completed: 17 },
    { period: "Aug", entered: 9, completed: 11 },
  ],
  // On-track share climbing while breaches fall, which is the "improving" the card claims.
  slaTrend: {
    onTrack: [24, 25, 27, 26, 29, 30, 31],
    breached: [6, 5, 5, 4, 2, 1, 0],
  },
  stageAccumulation: [
    { stage: "Medical Evidence & Quantum Decision", cases: 14 },
    { stage: "Liability Assessment & Admission", cases: 9 },
    { stage: "Quantum Assessment & Settlement Negotiation", cases: 7 },
    { stage: "Claim Intake & Registration", cases: 5 },
    { stage: "Rehabilitation & Return-to-Work", cases: 4 },
    { stage: "Injury Triage & Track Assignment", cases: 3 },
    { stage: "Subrogation & Recovery", cases: 2 },
    { stage: "Settlement & Closure", cases: 2 },
  ],
  avgCoverageDecisionDays: 1.8,
  restorationAdherence: 71,
  criticalAtRisk: 5,
  criticalAtRiskDelta: 1,
  repeatFailureCandidates: 4,
  repeatFailureNote: "2 linked to the same third-party insurer",
};

/**
 * What the signer says about the *reasoning*, asked separately from the outcome.
 * This is the beat worth reading aloud, and it is the learning signal
 * continuous improvement reads later.
 */
export const REASONING_OPTIONS: ReasoningOption[] = [
  {
    value: "agree",
    label: "I agree with the reasoning",
    effect: "Recorded as agreement with no standing instruction. You'll still see the next one.",
  },
  {
    value: "agree-keep-asking",
    label: "I agree, but keep asking me",
    effect: "Recorded as agreement, and this case type stays in your queue.",
  },
  {
    value: "stop-asking",
    label: "Stop asking for cases like this",
    effect: "Proposed as a rule. Cases matching this shape stop waiting for a person once approved.",
  },
];
