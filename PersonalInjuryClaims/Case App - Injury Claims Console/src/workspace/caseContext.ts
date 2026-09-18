/**
 * Case context shown around a decision: the medical and financial evidence
 * being reviewed, and the conversation on the claim. Falls back to
 * representative content when a live task does not carry these fields yet.
 */

export interface EvidenceDoc {
  id: string;
  title: string;
  summary: string;
  body: string;
  addedAgo: string;
  addedBy: string;
}

export interface CaseComment {
  id: string;
  initials: string;
  author: string;
  role: string;
  ago: string;
  text: string;
  /** Portion of `text` to mark as the operative line. */
  highlight?: string;
}

export interface CaseHeader {
  caseId: string;
  customer: string;
  assetLine: string;
  due: string;
  assignee: string;
  assigneeInitials: string;
  slaLabel: string;
  slaElapsed: string;
  slaAtRisk: boolean;
  priority: string;
  blocking: boolean;
}

export const FALLBACK_HEADER: CaseHeader = {
  caseId: 'CLAIM-5182',
  customer: 'Joseph Thompson',
  assetLine: 'CLAIM-5182 · Whiplash / soft-tissue injury · £27,400',
  due: '5:15 PM',
  assignee: 'Dana Ferris',
  assigneeInitials: 'DF',
  slaLabel: 'SLA 4 HR',
  slaElapsed: '3 HR 12 MIN ELAPSED',
  slaAtRisk: true,
  priority: 'P1',
  blocking: true,
};

export const EVIDENCE: EvidenceDoc[] = [
  {
    id: 'ev-1',
    title: 'Medical records bundle',
    summary: 'GP records consistent with an acute soft-tissue injury',
    body:
      'The GP records show Mr Thompson presented at the Castle Street practice on 4 March, within 36 hours of the collision, reporting neck and upper-back pain, restricted rotation and headache. The examining GP recorded reduced cervical range of motion and prescribed a short course of analgesia with a referral to physiotherapy. There is no entry in the preceding five years for neck or back complaints, and no record of a prior road traffic accident. The presentation and the interval between accident and first attendance are both consistent with an acute whiplash-associated disorder rather than an aggravation of a pre-existing condition.',
    addedAgo: '6 hrs ago',
    addedBy: 'Injury assessor: Marcus Ibe',
  },
  {
    id: 'ev-2',
    title: 'Treatment and rehabilitation plan',
    summary: 'Itemised care and rehabilitation costs, £27,400',
    body:
      "The rehabilitation provider's plan covers an initial physiotherapy block of 12 sessions (£3,150), a further graded exercise block over 11 weeks (£4,900), two follow-up consultant reviews (£2,300), nine days of assisted care during the acute phase (£1,850), and a structured return-to-work programme with phased hours (£6,200). Care and rehabilitation costs come to £27,400 against a reserve of £250,000, comfortably inside the reserve set at intake. The initial triage assessment came to £1,180, inside the £5,000 early-intervention sub-limit, and was invoiced and paid separately from this plan.",
    addedAgo: '5 hrs ago',
    addedBy: 'Rehabilitation provider: Halberd Rehabilitation',
  },
  {
    id: 'ev-3',
    title: 'Policy schedule extract',
    summary: 'Limits, excesses and the notification condition',
    body:
      "Personal injury limit of indemnity £250,000; legal expenses cover £45,000. The standard policy excess is £500, with an additional £250 excess applying to treatment costs. The schedule confirms early-intervention treatment cover up to £5,000, and a notification condition requiring the claimant to report an accident within 30 consecutive days. Cover for treatment costs is suspended beyond that point unless the insurer agreed the delay in advance. Nothing on file shows the claimant gave that notice.",
    addedAgo: '5 hrs ago',
    addedBy: 'Policy administration extract',
  },
  {
    id: 'ev-4',
    title: 'Loss of earnings schedule',
    summary: 'Two heads of special damages, both evidenced',
    body:
      "The claimant has listed lost earnings over an eleven-week absence (£2,400, payslips provided for the twelve months before the accident) and travel to treatment appointments (£1,150, no receipts but a bank statement shows the payments in the same period) as special damages arising from the injury. Both heads are consistent with the absence recorded by the employer and with the appointment dates on the treatment plan. No other heads of special damage are claimed. Documentary proof is considered satisfactory for both against the £45,000 legal expenses and disbursements limit.",
    addedAgo: '5 hrs ago',
    addedBy: 'Loss of earnings schedule, employer payroll',
  },
  {
    id: 'ev-5',
    title: 'IME report',
    summary: 'Prognosis for full recovery at nine months',
    body:
      'The independent medical examination was carried out on 12 March. Cervical rotation measured 45 degrees at the first review against an expected 80, improving to within normal range by the ninth review. Lumbar findings started restricted and reached functional range by week seven. The examiner records a single, well-defined injury pattern consistent with the reported mechanism, with no secondary complaints found elsewhere. The impairment rating is assessed as minor, and the examiner cites this pattern as supporting a single, recent injury rather than a longstanding or recurring condition.',
    addedAgo: '4 hrs ago',
    addedBy: 'Independent Medical Examination',
  },
  {
    id: 'ev-6',
    title: 'Accident circumstances report',
    summary: 'Scene evidence and the police report',
    body:
      'The accident circumstances report draws on the police report filed on 3 March: vehicle positions at the signalised junction, the damage profile to the rear of the claimant’s vehicle, and the third-party driver’s account at the scene. Three further photographs, taken by the claimant on 3 February — before the accident, while the vehicle was being prepared for sale — show the same rear panel with no visible damage. The assessor uses these to bound the injury and the damage to the collision itself rather than to any earlier event.',
    addedAgo: '4 hrs ago',
    addedBy: 'Injury assessor: Marcus Ibe',
  },
];

export const COMMENTS: CaseComment[] = [
  {
    id: 'c-1',
    initials: 'MI',
    author: 'Marcus Ibe',
    role: 'Injury Assessor',
    ago: '9 hr ago',
    text:
      'Mr Thompson reports a flare-up in the last fortnight that the IME report predates. Need new medical information on file before we put a settlement offer to him.',
    highlight: 'Need new medical information on file before we put a settlement offer to him.',
  },
  {
    id: 'c-2',
    initials: 'TB',
    author: 'Tom Beckerman',
    role: 'Claims Administrator',
    ago: '4 hr ago',
    text:
      "The practice has confirmed two further appointments in the last three weeks, and the employer's absence record puts him back at reduced hours rather than fully recovered. On that basis I don't think the current quantum stands — recommend requesting the updated records before any offer.",
  },
];

/** Reads a header from live task data where present, falling back per field. */
export function headerFromTask(data: Record<string, unknown> | null): CaseHeader {
  if (!data) return FALLBACK_HEADER;
  const str = (k: string) => (typeof data[k] === 'string' ? (data[k] as string) : undefined);
  const num = (k: string) => (typeof data[k] === 'number' ? (data[k] as number) : undefined);
  const cost = num('estimatedCost');
  const injuryType = str('injuryTypeCode');
  const caseId = str('claimReference') ?? FALLBACK_HEADER.caseId;
  const authorityLimit = num('authorityLimit');
  const parts = [caseId, injuryType, cost != null ? `£${cost.toLocaleString()}` : undefined]
    .filter(Boolean)
    .join(' · ');
  return {
    ...FALLBACK_HEADER,
    caseId,
    customer: str('claimantName') ?? FALLBACK_HEADER.customer,
    assetLine: parts || FALLBACK_HEADER.assetLine,
    priority: cost != null && authorityLimit != null && cost > authorityLimit ? 'P1' : FALLBACK_HEADER.priority,
  };
}
