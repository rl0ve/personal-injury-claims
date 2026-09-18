/**
 * Representative data for the console surfaces.
 * Grounded in personal injury claims: a rear-shunt whiplash claim waiting on
 * new medical information, a fractured-wrist claim with a disputed liability
 * split, and a soft-tissue claim whose condition deteriorated after closure.
 */

export interface QueueCase {
  id: string;
  claimantName: string;
  incidentLocation: string;
  peril: string;
  causeOfLoss: string;
  /** Why this one needs a person — the single most important line in the queue. */
  reason: string;
  recommendation: string;
  estimatedCost: number;
  notificationDelayDays: number;
  slaHoursLeft: number;
  impact: 'Critical' | 'High' | 'Moderate';
  waitingOn: string;
}

export const QUEUE: QueueCase[] = [
  {
    id: 'CLAIM-5182',
    claimantName: 'Joseph Thompson',
    incidentLocation: 'Oxford Road at Castle Street, Reading, RG1 7LS',
    peril: 'Whiplash / soft-tissue injury',
    causeOfLoss: 'Rear-end collision at a signalised junction',
    reason:
      'Liability is admitted, but the quantum still rests on an IME report that predates the claimant’s reported flare-up. New medical information has been requested and is not yet on file, so neither a settlement offer nor a closure is right until it arrives.',
    recommendation: 'Hold the offer — waiting on new medical information',
    estimatedCost: 18400,
    notificationDelayDays: 18,
    slaHoursLeft: 6,
    impact: 'Critical',
    waitingOn: 'Your decision',
  },
  {
    id: 'CLAIM-5171',
    claimantName: 'Daniel Okafor',
    incidentLocation: 'Meridian Park distribution depot, Swindon, SN3 4TZ',
    peril: 'Fracture — left wrist',
    causeOfLoss: 'Fall from a loading bay edge, workplace accident',
    reason:
      'The employer’s own incident log records an unguarded bay edge eleven months before the accident, which cuts against the contributory negligence split the third-party insurer has proposed. The revised quantum sits above standard authority and needs a settlement decision.',
    recommendation: 'Authorise the revised settlement at 100% liability',
    estimatedCost: 42750,
    notificationDelayDays: 0,
    slaHoursLeft: 19,
    impact: 'High',
    waitingOn: 'Your decision',
  },
  {
    id: 'CLAIM-5155',
    claimantName: 'Rosalind Hayes',
    incidentLocation: 'Mill Lane pedestrian crossing, Newark, Nottinghamshire',
    peril: 'Soft-tissue injury — lower back',
    causeOfLoss: 'Pedestrian struck at low speed',
    reason:
      'Physiotherapy discharge notes arrived after the claim was closed. They appear to describe a pre-existing degenerative condition rather than accident-related injury, and the case agent has routed the closure back for review.',
    recommendation: 'Confirm or return the closure for further review',
    estimatedCost: 6100,
    notificationDelayDays: 0,
    slaHoursLeft: 31,
    impact: 'Moderate',
    waitingOn: 'Injury assessor review',
  },
];

export interface Insight {
  label: string;
  value: string;
  detail: string;
  tone: 'good' | 'warn' | 'plain';
}

export const INSIGHTS: Insight[] = [
  {
    label: 'Finished without anyone touching them',
    value: '91%',
    detail: '1,129 of 1,241 personal injury claims closed autonomously in the last 30 days.',
    tone: 'good',
  },
  {
    label: 'Reached a person',
    value: '112',
    detail: 'Claims where policy could not settle liability or quantum on the evidence available.',
    tone: 'plain',
  },
  {
    label: 'At risk of breaching SLA',
    value: '4',
    detail: 'All four are waiting on a liability or settlement decision, not on evidence.',
    tone: 'warn',
  },
  {
    label: 'Median time to a liability decision',
    value: '3.8h',
    detail: 'Down from 27 hours before the claim was orchestrated.',
    tone: 'good',
  },
];

export const PILING_UP = [
  { reason: 'Notification delay approaches the policy’s reporting condition', count: 29, trend: '+9' },
  { reason: 'Contributory negligence split must be confirmed before settlement', count: 22, trend: '+4' },
  { reason: 'Quantum above the claims officer’s delegated authority', count: 17, trend: '-3' },
  { reason: 'Medical evidence arrived after liability was decided', count: 11, trend: '+2' },
];

export interface LedgerEntry {
  caseId: string;
  customer: string;
  decision: string;
  decidedBy: string;
  when: string;
  /** The human rationale — the part the system cannot generate for itself. */
  rationale: string;
  agreement: string;
}

export const LEDGER: LedgerEntry[] = [
  {
    caseId: 'CLAIM-5172',
    customer: 'Joseph Thompson',
    decision: 'Liability admitted — rear-end collision, no contributory negligence',
    decidedBy: 'Dana Ferris',
    when: '2 days ago',
    rationale:
      'The police report and the third-party insurer’s own account both put the collision squarely on the following vehicle, and the claimant was stationary at a red signal. The GP records show a first presentation within 48 hours, so the notification delay does not weaken causation.',
    agreement: 'Agreed with reasoning; asked to keep being consulted on delayed-notification claims',
  },
  {
    caseId: 'CLAIM-5149',
    customer: 'Owen Bracewell',
    decision: 'Settled with a 25% contributory negligence reduction',
    decidedBy: 'Dana Ferris',
    when: '4 days ago',
    rationale:
      'Full quantum assessed at £340,000 against general and special damages of £250,000 once the reduction is applied. Contributory negligence set at 25% for failure to wear the supplied harness, consistent with the IME findings.',
    agreement: 'Agreed with reasoning and recommendation',
  },
  {
    caseId: 'CLAIM-5103',
    customer: 'Daniel Okafor',
    decision: 'Referred to the injury assessor for a revised quantum',
    decidedBy: 'Marcus Ibe',
    when: '6 days ago',
    rationale:
      'The updated loss of earnings schedule adds £9,200 to the original reserve. That crosses my delegated authority, so it needs a second look before an offer goes out.',
    agreement: 'Reasoning incomplete — added a lower authority threshold for wage-loss revisions',
  },
  {
    caseId: 'CLAIM-5061',
    customer: 'Rosalind Hayes',
    decision: 'Confirmed — accident-related soft-tissue injury upheld',
    decidedBy: 'Dana Ferris',
    when: '9 days ago',
    rationale: 'The presenting symptoms match the mechanism of injury, and the degenerative findings post-date the accident.',
    agreement: 'Agreed; asked not to be consulted on similar claims',
  },
];

export interface Suggestion {
  id: string;
  pattern: string;
  evidence: string;
  existingRule: string;
  proposedRule: string;
  casesAffected: number;
  confidence: string;
}

export const SUGGESTIONS: Suggestion[] = [
  {
    id: 'SUG-01',
    pattern:
      'When the notification delay is under 30 days and the GP records show a first presentation within 72 hours, claims officers always admit liability without waiting on a person.',
    evidence: '14 of 14 decisions over 6 weeks, three claims officers, five claimants.',
    existingRule:
      'Any notification-delay flag on a soft-tissue claim routes to a claims officer for a liability decision.',
    proposedRule:
      'If the notification delay is under 30 days and the GP records show a first presentation within 72 hours of the accident, admit liability and record why. Route to a claims officer only when the delay meets or exceeds the policy condition.',
    casesAffected: 29,
    confidence: 'High',
  },
  {
    id: 'SUG-02',
    pattern:
      'Contributory negligence is consistently applied the same way once an IME report and a police report are both on file.',
    evidence: '9 of 10 decisions, two claims officers.',
    existingRule: 'Contributory negligence is flagged on the claim but does not change routing.',
    proposedRule:
      'Once an IME report and a police report are both on file and the proposed reduction is at or below 25%, apply the split automatically and record the calculation. Route to a claims officer only above the authority limit.',
    casesAffected: 22,
    confidence: 'Medium',
  },
];
