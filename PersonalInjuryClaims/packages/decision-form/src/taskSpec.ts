/**
 * Everything the task screen renders is derived from this spec, keyed by
 * actionType. No branch on actionType belongs in Form.tsx — add a new
 * action here instead.
 *
 * Rule PASS/FAIL, the recommended outcome, and the headline/rationale text
 * are all computed from the live task inputs (see `evaluate`), so a
 * Declined-shaped input (pre-existing condition, liability not in force, 75 day notification delay)
 * genuinely produces FAILs and a Declined recommendation, and a clean input
 * genuinely produces all PASS and a Covered recommendation.
 */

export interface FormData {
  // inputs
  actionType: string;
  /**
   * The Maestro case instance this task belongs to. Passed down by the case
   * plan as `=js:(metadata.InstanceId)`, because Action Center's Task object
   * carries taskId and folderId but nothing that identifies the case. The
   * Data Fabric event row is keyed on it: the global event filters on
   * `CaseId == metadata.InstanceId`, so a row written without it wakes nothing.
   */
  caseInstanceId: string;
  claimReference: string;
  claimantName: string;
  incidentLocation: string;
  injuryTypeCode: string;
  liabilityBasisCode: string;
  liabilityOutcome: string;
  settlementBasis: string;
  settlementPath: string;
  uploadedDocumentName: string;
  decisionRationale: string;
  agentRationale: string;
  notificationDelayDays: number;
  fraudScore: number;
  estimatedCost: number;
  authorityLimit: number;
  recoveryAmountReceived: number;
  liabilityCoverInForce: boolean;
  contributoryNegligenceFlag: boolean;
  closureReasonCode: string;
  settlementOutcome: string;
  // outputs
  evidenceHelpful: string;
}

export const defaultFormData: FormData = {
  actionType: '',
  caseInstanceId: '',
  claimReference: '',
  claimantName: '',
  incidentLocation: '',
  injuryTypeCode: '',
  liabilityBasisCode: '',
  liabilityOutcome: '',
  settlementBasis: '',
  settlementPath: '',
  uploadedDocumentName: '',
  decisionRationale: '',
  agentRationale: '',
  notificationDelayDays: 0,
  fraudScore: 0,
  estimatedCost: 0,
  authorityLimit: 0,
  recoveryAmountReceived: 0,
  liabilityCoverInForce: false,
  contributoryNegligenceFlag: false,
  closureReasonCode: '',
  settlementOutcome: '',
  evidenceHelpful: '',
};

export interface Outcome {
  key: string;
  label: string;
  variant: 'primary' | 'secondary';
}

export interface RuleResult {
  name: string;
  status: 'pass' | 'fail';
  actual: string;
  threshold: string;
}

export interface FactTile {
  label: string;
  value: string;
  detail: string;
}

export interface Metric {
  label: string;
  value: string;
}

export interface TaskSpec {
  title: string;
  coverType: string;
  notesLabel: string;
  notesPlaceholder: string;
  notesRequired: boolean;
  outcomes: Outcome[];
  recommendedOutcomeKey: string;
  recommendationHeadline: string;
  recommendationLines: string[];
  metrics: Metric[];
  factTiles: FactTile[];
  rules: RuleResult[];
  notable: string;
  riskFactors: string[];
  /** Present when the task collects a document rather than a decision. */
  upload?: {
    label: string;
    hint: string;
    /** Submission is blocked until a file is attached. */
    required: boolean;
  };
}

export const INSURER_NAME = 'Aldergate Personal Injury';
export const INSURER_SUBTITLE = 'Personal injury claims';
export const INSURER_INITIAL = 'A';

const money = (n: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n);

const isBlank = (v: string) => v === undefined || v === null || v.trim() === '';
const str = (v: string, fb: string) => (isBlank(v) ? fb : v);
const numFb = (v: number, fb: number) => (v === undefined || v === null || Number.isNaN(v) || v === 0 ? fb : v);

/** Fully populated view of the task data — representative content stands in for anything missing. */
interface Resolved {
  claimReference: string;
  claimantName: string;
  incidentLocation: string;
  injuryTypeCode: string;
  liabilityBasisCode: string;
  settlementBasis: string;
  settlementPath: string;
  uploadedDocumentName: string;
  notificationDelayDays: number;
  fraudScore: number;
  estimatedCost: number;
  authorityLimit: number;
  recoveryAmountReceived: number;
  liabilityCoverInForce: boolean;
  contributoryNegligenceFlag: boolean;
  closureReasonCode: string;
  settlementOutcome: string;
}

function resolve(fd: FormData): Resolved {
  return {
    claimReference: str(fd.claimReference, 'CLAIM-5182'),
    claimantName: str(fd.claimantName, 'Joseph Thompson'),
    incidentLocation: str(fd.incidentLocation, 'A4155 Caversham Road junction with Vastern Road, Reading'),
    injuryTypeCode: str(fd.injuryTypeCode, 'Whiplash'),
    liabilityBasisCode: str(fd.liabilityBasisCode, 'RearEndCollision'),
    settlementBasis: str(fd.settlementBasis, 'Full Liability'),
    uploadedDocumentName: str(fd.uploadedDocumentName, ''),
    settlementPath: str(fd.settlementPath, 'Negotiated Settlement'),
    notificationDelayDays: numFb(fd.notificationDelayDays, 0),
    fraudScore: numFb(fd.fraudScore, 20),
    estimatedCost: numFb(fd.estimatedCost, 27400),
    authorityLimit: numFb(fd.authorityLimit, 35000),
    recoveryAmountReceived: fd.recoveryAmountReceived || 0,
    liabilityCoverInForce: fd.liabilityCoverInForce,
    contributoryNegligenceFlag: fd.contributoryNegligenceFlag,
    closureReasonCode: str(fd.closureReasonCode, 'Settlement reconciled, no outstanding scope'),
    settlementOutcome: str(fd.settlementOutcome, 'Settled'),
  };
}

/**
 * The liability basis in words a claims officer would use.
 *
 * The codes are what the case carries and what the rules test, but a screen
 * that prints `RearEndCollision` at a reader is showing its plumbing. Anything
 * unmapped falls back to the code rather than to a guess.
 */
const BASIS_IN_WORDS: Record<string, string> = {
  RearEndCollision: 'a rear-end collision',
  PedestrianCrossing: 'a collision on a marked crossing',
  SideRoadEmergence: 'a vehicle emerging from a side road',
  WorkplaceVehicle: 'a workplace vehicle incident',
  PreExistingCondition: 'a pre-existing condition',
};
const basisInWords = (basis: string) => BASIS_IN_WORDS[basis] ?? basis;

const isDisputedBasis = (basis: string) => /pre-?existing|shared/i.test(basis);
const isAttributableInjury = (injury: string) => !/uninsured|excluded/i.test(injury);
const FRAUD_REFERRAL = 75;
const NOTIFICATION_CONDITION_DAYS = 30;

const confidenceFromRules = (rules: RuleResult[]): Metric => {
  const total = rules.length || 1;
  const passed = rules.filter((r) => r.status === 'pass').length;
  const pct = Math.round((passed / total) * 100);
  const label = pct >= 90 ? 'High' : pct >= 70 ? 'Medium-High' : pct >= 50 ? 'Medium' : 'Low';
  return { label: 'Confidence', value: `${label} ${pct}%` };
};

const rulesMetric = (rules: RuleResult[]): Metric => {
  const passed = rules.filter((r) => r.status === 'pass').length;
  return { label: 'Rules', value: `${passed}/${rules.length} passed` };
};

function buildSubmitMedicalEvidence(fd: FormData): TaskSpec {
  const r = resolve(fd);
  const disputed = isDisputedBasis(r.injuryTypeCode);
  const injuryAttributable = isAttributableInjury(r.injuryTypeCode);
  const notificationOk = r.notificationDelayDays < NOTIFICATION_CONDITION_DAYS;
  const liabilityOk = !disputed || r.liabilityCoverInForce;
  const fraudOk = r.fraudScore < FRAUD_REFERRAL;
  const averageOk = !r.contributoryNegligenceFlag;

  const rules: RuleResult[] = [
    {
      name: 'Policy in force on the date of the accident',
      status: 'pass',
      actual: 'In force',
      threshold: 'Required',
    },
    {
      name: 'Injury attributable to the accident',
      status: injuryAttributable ? 'pass' : 'fail',
      actual: r.injuryTypeCode,
      threshold: 'Attributable to the accident',
    },
    {
      name: 'Notified inside the 30-day condition',
      status: notificationOk ? 'pass' : 'fail',
      actual: `${r.notificationDelayDays} days`,
      threshold: `${NOTIFICATION_CONDITION_DAYS}-day condition`,
    },
    {
      name: 'Contributory negligence',
      status: averageOk ? 'pass' : 'fail',
      actual: r.contributoryNegligenceFlag ? 'Alleged, damages at 75%' : 'Not alleged',
      threshold: 'Full liability',
    },
    {
      name: 'Liability cover in force',
      status: liabilityOk ? 'pass' : 'fail',
      actual: disputed ? (r.liabilityCoverInForce ? 'In force' : 'Not in force') : 'Not applicable',
      threshold: 'Required where the basis is disputed',
    },
    {
      name: 'Fraud and prior-claims screening',
      status: fraudOk ? 'pass' : 'fail',
      actual: String(r.fraudScore),
      threshold: `${FRAUD_REFERRAL} referral`,
    },
  ];

  let recommendedOutcomeKey: string;
  let headline: string;
  let lines: string[];

  /*
    What the agent says here is not a verdict, because this task is not a
    decision any more. The claims officer supplies the medical evidence and
    submits; the Case Manager Agent decides what that sets in motion. So the
    headline names what the claim is waiting on and why a person is holding it,
    which is the sentence the demo script puts in Dana's mouth. It used to read
    "Confirm cover in full" over a form with a single Submit button and nothing
    to confirm.
  */
  if (!injuryAttributable) {
    recommendedOutcomeKey = 'Submitted';
    headline = 'Attribution is unresolved';
    lines = [
      `${r.injuryTypeCode} has not been attributed to the accident, so quantum cannot be assembled against it.`,
      'Attach whatever the provider has sent. The case agent picks up the attribution question from there.',
    ];
  } else if (disputed && !r.liabilityCoverInForce) {
    recommendedOutcomeKey = 'Submitted';
    headline = 'Liability is disputed and cover is not in force';
    lines = [
      'The injury is attributed to a pre-existing condition and liability cover is not in force on this policy.',
      'Attach the records and note what the provider says. New medical evidence is the only thing that moves a disputed attribution.',
    ];
  } else if (!fraudOk) {
    recommendedOutcomeKey = 'Submitted';
    headline = 'Screening has referred this claim';
    lines = [
      `The screening score of ${r.fraudScore} clears the ${FRAUD_REFERRAL}-point referral threshold.`,
      'Attach the records anyway. The referral runs alongside, and the evidence is needed either way.',
    ];
  } else if (!notificationOk) {
    recommendedOutcomeKey = 'Submitted';
    headline = 'Notification fell outside the condition';
    lines = [
      `Symptoms were notified ${r.notificationDelayDays} days after the accident, at or beyond the ${NOTIFICATION_CONDITION_DAYS}-day condition.`,
      'The records should carry the date of knowledge. Attach them and note what they say.',
    ];
  } else if (r.contributoryNegligenceFlag) {
    recommendedOutcomeKey = 'Submitted';
    headline = 'Quantum is waiting on the updated records';
    lines = [
      'Damages settle at 75%. The third-party insurer admits primary liability but alleges 25% contributory negligence for late braking.',
      'No rule decides how much of the care, rehabilitation and treatment lines sits outside that reduction, and the updated records are still outstanding. That is why this is with a person.',
    ];
  } else {
    recommendedOutcomeKey = 'Submitted';
    headline = 'This claim is waiting on new medical information';
    lines = [
      `Liability is established on ${basisInWords(r.liabilityBasisCode)}, and notification stands inside the ${NOTIFICATION_CONDITION_DAYS}-day condition.`,
      'Attach the records and add a note. Everything else has cleared, and quantum cannot start until the provider records are on the case.',
    ];
  }

  const sumInsured = Math.max(150000, Math.round((r.estimatedCost * 19) / 10000) * 10000);

  return {
    title: 'Event - medical record upload',
    coverType: 'Third party liability',
    notesLabel: 'Note for the case',
    notesPlaceholder: 'Say what the provider sent and what changed. This goes on the case.',
    notesRequired: false,
    // The claims officer supplies evidence here; they do not adjudicate. The
    // Case Manager Agent decides what the evidence sets in motion.
    upload: {
      label: 'Medical evidence',
      hint: 'Attach the records the provider sent, then add a note for the case.',
      required: true,
    },
    outcomes: [{ key: 'Submitted', label: 'Submit', variant: 'primary' as const }],
    recommendedOutcomeKey,
    recommendationHeadline: headline,
    recommendationLines: lines,
    metrics: [
      /*
        No confidence figure on this one. It is derived from the rule pass rate,
        which is 6 of 6 here, so the card read "Confidence High 100%" directly
        above a headline saying the claim is waiting on evidence nobody has yet.
        What the reader needs is what is missing, so that is what the slot says.
      */
      rulesMetric(rules),
      { label: 'Outstanding', value: 'Provider records' },
      { label: 'Precedent matches', value: '3 last 90d' },
    ],
    factTiles: [
      { label: 'Claimant', value: r.claimantName, detail: r.incidentLocation },
      { label: 'Estimated cost', value: money(r.estimatedCost), detail: `${r.settlementBasis.toLowerCase()} basis` },
      {
        label: 'Policy limit / contribution',
        value: money(sumInsured),
        detail: r.contributoryNegligenceFlag ? 'reduction applied' : 'not applied',
      },
      { label: 'Fraud score', value: String(r.fraudScore), detail: 'screening' },
    ],
    rules,
    notable: !injuryAttributable
      ? `${r.injuryTypeCode} is not attributable to the insured event on the evidence recorded.`
      : disputed && !r.liabilityCoverInForce
        ? `The injury is attributed to a pre-existing condition and the policy shows no liability cover in force.`
        : !fraudOk
          ? `The fraud score of ${r.fraudScore} clears the referral threshold and has not yet been investigated.`
          : !notificationOk
            ? `${r.claimantName}'s account of when symptoms arose needs confirming against the ${r.notificationDelayDays}-day notification delay on file.`
            : `${r.claimantName}'s GP and physiotherapy records show continuous treatment from the date of the accident, keeping notification inside the ${NOTIFICATION_CONDITION_DAYS}-day condition.`,
    riskFactors: [
      r.notificationDelayDays >= 20 && r.notificationDelayDays < NOTIFICATION_CONDITION_DAYS
        ? `Notification delay at ${r.notificationDelayDays} days is approaching the ${NOTIFICATION_CONDITION_DAYS}-day condition`
        : null,
      r.fraudScore >= 50 && r.fraudScore < FRAUD_REFERRAL
        ? `Fraud score of ${r.fraudScore} is elevated but below the referral threshold`
        : null,
      r.contributoryNegligenceFlag ? 'Contributory negligence detected — a reduction applies to any settlement' : null,
      disputed ? 'A disputed liability basis carries its own cover condition, checked separately above' : null,
    ]
      .filter((x): x is string => Boolean(x))
      .concat([
        'Single medical examination — no second opinion on file',
        'Treatment provider estimate has not yet been itemised line by line',
      ])
      .slice(0, 4),
  };
}

function buildAuthoriseSettlement(fd: FormData): TaskSpec {
  const r = resolve(fd);
  const withinAuthority = r.estimatedCost <= r.authorityLimit;
  const basisAgreed = ['Full Liability', 'Reduced for Contributory Negligence'].some((b) => r.settlementBasis.toLowerCase().includes(b.toLowerCase()));
  const scopeSignedOff = ['Negotiated Settlement', 'Part 36 Offer', 'Without Prejudice'].some((p) =>
    r.settlementPath.toLowerCase().includes(p.toLowerCase()),
  );

  const rules: RuleResult[] = [
    {
      name: 'Estimated cost within authority',
      status: withinAuthority ? 'pass' : 'fail',
      actual: money(r.estimatedCost),
      threshold: `${money(r.authorityLimit)} limit`,
    },
    {
      name: 'Settlement basis agreed',
      status: basisAgreed ? 'pass' : 'fail',
      actual: r.settlementBasis,
      threshold: 'Full or reduced liability',
    },
    {
      name: 'Quantum signed off',
      status: scopeSignedOff ? 'pass' : 'fail',
      actual: r.settlementPath,
      threshold: 'Sign-off recorded',
    },
  ];

  let recommendedOutcomeKey: string;
  let headline: string;
  let lines: string[];

  if (!withinAuthority) {
    recommendedOutcomeKey = 'Referred';
    headline = 'Refer above your authority';
    lines = [
      `The settlement of ${money(r.estimatedCost)} sits above your ${money(r.authorityLimit)} authority limit.`,
      'Route this to the next authority level rather than approving it directly.',
    ];
  } else if (r.settlementBasis.toLowerCase().includes('disputed')) {
    recommendedOutcomeKey = 'Rejected';
    headline = 'Reject the settlement';
    lines = [
      'The settlement basis is recorded as disputed and has not been agreed with the insured.',
      'Reject and return the settlement for the basis to be re-agreed.',
    ];
  } else if (!basisAgreed || !scopeSignedOff) {
    recommendedOutcomeKey = 'Partial';
    headline = 'Approve part of the scope';
    lines = [
      !basisAgreed
        ? `The settlement basis "${r.settlementBasis}" is not yet a standard full or reduced liability basis.`
        : `The settlement path "${r.settlementPath}" has not been signed off in full.`,
      'Approve the agreed part of the quantum and hold the balance until it is resolved.',
    ];
  } else {
    recommendedOutcomeKey = 'Approved';
    headline = 'Approve the settlement';
    lines = [
      'The treatment plan is itemised and reasonable, and the cost sits within your authority limit.',
      `The settlement basis (${r.settlementBasis}) matches the policy and the treatment plan is signed off.`,
    ];
  }

  return {
    title: 'Authorise Settlement',
    coverType: 'Third party liability',
    notesLabel: 'Note for the case',
    notesPlaceholder: 'Say what the provider sent and what changed. This goes on the case.',
    notesRequired: true,
    outcomes: [
      { key: 'Rejected', label: 'Reject settlement', variant: 'secondary' },
      { key: 'Referred', label: 'Refer above authority', variant: 'secondary' },
      { key: 'Partial', label: 'Approve partial scope', variant: 'secondary' },
      { key: 'Approved', label: 'Approve settlement', variant: 'primary' },
    ].map((o) => ({ ...o, variant: o.key === recommendedOutcomeKey ? 'primary' : 'secondary' })),
    recommendedOutcomeKey,
    recommendationHeadline: headline,
    recommendationLines: lines,
    metrics: [
      confidenceFromRules(rules),
      rulesMetric(rules),
      { label: 'Precedent matches', value: '5 last 90d' },
    ],
    factTiles: [
      { label: 'Claimant', value: r.claimantName, detail: r.incidentLocation },
      { label: 'Estimated cost', value: money(r.estimatedCost), detail: `${r.settlementBasis.toLowerCase()} basis` },
      {
        label: 'Authority limit',
        value: money(r.authorityLimit),
        detail: withinAuthority ? 'within limit' : 'exceeds limit',
      },
      { label: 'Recovery received', value: money(r.recoveryAmountReceived), detail: r.settlementPath },
    ],
    rules,
    notable: !withinAuthority
      ? `The ${money(r.estimatedCost)} settlement exceeds your ${money(r.authorityLimit)} authority limit and needs referral.`
      : `The treatment plan behind this ${money(r.estimatedCost)} settlement is itemised against the ${r.settlementPath.toLowerCase()} route.`,
    riskFactors: [
      !basisAgreed ? `Settlement basis "${r.settlementBasis}" is non-standard` : null,
      !scopeSignedOff ? `Scope sign-off on "${r.settlementPath}" is incomplete` : null,
      r.recoveryAmountReceived > 0 ? `${money(r.recoveryAmountReceived)} already recovered — net settlement should reflect it` : null,
    ]
      .filter((x): x is string => Boolean(x))
      .concat(['Vendor invoice has not yet been reconciled against the scope', 'One outstanding photograph set from the final inspection'])
      .slice(0, 4),
  };
}

function buildAuthoriseSupplementalTreatment(fd: FormData): TaskSpec {
  const r = resolve(fd);
  const withinAuthority = r.estimatedCost <= r.authorityLimit;
  const attributable = !isBlank(r.liabilityBasisCode) && isAttributableInjury(r.liabilityBasisCode);
  const fraudOk = r.fraudScore < FRAUD_REFERRAL;

  const rules: RuleResult[] = [
    {
      name: 'Additional cost within authority',
      status: withinAuthority ? 'pass' : 'fail',
      actual: money(r.estimatedCost),
      threshold: `${money(r.authorityLimit)} limit`,
    },
    {
      name: 'Liability basis attributable to the insured event',
      status: attributable ? 'pass' : 'fail',
      actual: r.liabilityBasisCode,
      threshold: 'Directly attributable',
    },
    {
      name: 'Fraud and prior-claims screening',
      status: fraudOk ? 'pass' : 'fail',
      actual: String(r.fraudScore),
      threshold: `${FRAUD_REFERRAL} referral`,
    },
  ];

  let recommendedOutcomeKey: string;
  let headline: string;
  let lines: string[];

  if (!withinAuthority) {
    recommendedOutcomeKey = 'ReferToSpecialist';
    headline = 'Refer to a medical specialist';
    lines = [
      `The supplemental cost of ${money(r.estimatedCost)} sits above your ${money(r.authorityLimit)} authority limit.`,
      'A second medical opinion should confirm the additional treatment before it is committed.',
    ];
  } else if (!attributable || !fraudOk) {
    recommendedOutcomeKey = 'Refused';
    headline = 'Refuse the supplemental treatment';
    lines = [
      !attributable
        ? `The additional work is not clearly attributable to the admitted liability basis (${r.liabilityBasisCode || 'not recorded'}).`
        : `The fraud score of ${r.fraudScore} clears the referral threshold on this additional claim.`,
      'The supplemental treatment does not stand up to review as it is currently evidenced.',
    ];
  } else {
    recommendedOutcomeKey = 'Authorised';
    headline = 'Authorise the supplemental treatment';
    lines = [
      `The additional work follows directly from ${r.liabilityBasisCode.toLowerCase()} and stays inside a reasonable course of treatment.`,
      `The cost of ${money(r.estimatedCost)} sits within your authority limit.`,
    ];
  }

  return {
    title: 'Authorise Supplemental Treatment',
    coverType: 'Third party liability',
    notesLabel: 'Authorisation notes',
    notesPlaceholder: 'Your basis for authorising, refusing, or referring.',
    notesRequired: false,
    outcomes: [
      { key: 'Refused', label: 'Refuse treatment', variant: 'secondary' },
      { key: 'ReferToSpecialist', label: 'Refer to specialist', variant: 'secondary' },
      { key: 'Authorised', label: 'Authorise treatment', variant: 'primary' },
    ].map((o) => ({ ...o, variant: o.key === recommendedOutcomeKey ? 'primary' : 'secondary' })),
    recommendedOutcomeKey,
    recommendationHeadline: headline,
    recommendationLines: lines,
    metrics: [
      confidenceFromRules(rules),
      rulesMetric(rules),
      { label: 'Precedent matches', value: '2 last 90d' },
    ],
    factTiles: [
      { label: 'Claimant', value: r.claimantName, detail: r.incidentLocation },
      { label: 'Additional cost', value: money(r.estimatedCost), detail: 'supplemental scope' },
      {
        label: 'Authority limit',
        value: money(r.authorityLimit),
        detail: withinAuthority ? 'within limit' : 'exceeds limit',
      },
      { label: 'Liability basis', value: r.liabilityBasisCode, detail: 'investigated cause' },
    ],
    rules,
    notable: `The supplemental scope of ${money(r.estimatedCost)} was raised mid-claim against ${r.liabilityBasisCode.toLowerCase()}.`,
    riskFactors: [
      !attributable ? 'Attribution to the admitted liability basis is not yet clear-cut' : null,
      !fraudOk ? `Fraud score of ${r.fraudScore} clears the referral threshold` : null,
    ]
      .filter((x): x is string => Boolean(x))
      .concat(['Supplemental invoice references the original scope but not line by line', 'No second inspection has been booked yet'])
      .slice(0, 4),
  };
}

function buildAuthoriseInvestigativeRestriction(fd: FormData): TaskSpec {
  const r = resolve(fd);
  const fraudSignal = r.fraudScore >= FRAUD_REFERRAL;
  const notificationSignal = r.notificationDelayDays >= NOTIFICATION_CONDITION_DAYS;
  const causeRecorded = !isBlank(r.liabilityBasisCode);

  const rules: RuleResult[] = [
    {
      name: 'Fraud score above referral threshold',
      status: fraudSignal ? 'pass' : 'fail',
      actual: String(r.fraudScore),
      threshold: `${FRAUD_REFERRAL} referral`,
    },
    {
      name: 'Notification delay at or beyond condition',
      status: notificationSignal ? 'pass' : 'fail',
      actual: `${r.notificationDelayDays} days`,
      threshold: `${NOTIFICATION_CONDITION_DAYS}-day condition`,
    },
    {
      name: 'Liability basis recorded for investigation',
      status: causeRecorded ? 'pass' : 'fail',
      actual: r.liabilityBasisCode,
      threshold: 'Recorded',
    },
  ];

  const shouldAuthorise = (fraudSignal || notificationSignal) && causeRecorded;
  const recommendedOutcomeKey = shouldAuthorise ? 'Authorised' : 'Refused';
  const headline = shouldAuthorise ? 'Authorise the restriction' : 'Refuse the restriction';
  const lines = shouldAuthorise
    ? [
        `The fraud score (${r.fraudScore}) and notification delay (${r.notificationDelayDays} days) together justify holding the claim open.`,
        'Authorise the restriction pending the outcome of the investigation.',
      ]
    : [
        `Neither the fraud score (${r.fraudScore}) nor the notification delay (${r.notificationDelayDays} days) clears the threshold for restricting cover.`,
        'There is not enough signal here to justify holding the claim open.',
      ];

  return {
    title: 'Authorise Investigative Restriction',
    coverType: 'Third party liability',
    notesLabel: 'Authorisation notes',
    notesPlaceholder: 'Your basis for authorising or refusing the restriction.',
    notesRequired: true,
    outcomes: [
      { key: 'Refused', label: 'Refuse restriction', variant: 'secondary' },
      { key: 'Authorised', label: 'Authorise restriction', variant: 'primary' },
    ].map((o) => ({ ...o, variant: o.key === recommendedOutcomeKey ? 'primary' : 'secondary' })),
    recommendedOutcomeKey,
    recommendationHeadline: headline,
    recommendationLines: lines,
    metrics: [
      confidenceFromRules(rules),
      rulesMetric(rules),
      { label: 'Precedent matches', value: '1 last 90d' },
    ],
    factTiles: [
      { label: 'Claimant', value: r.claimantName, detail: r.incidentLocation },
      { label: 'Fraud score', value: String(r.fraudScore), detail: 'screening' },
      { label: 'Notification delay', value: `${r.notificationDelayDays} days`, detail: `${NOTIFICATION_CONDITION_DAYS}-day condition` },
      { label: 'Liability basis', value: r.liabilityBasisCode, detail: 'under investigation' },
    ],
    rules,
    notable: shouldAuthorise
      ? `Both the fraud score and the notification delay on this claim sit outside the normal range.`
      : `Neither the fraud score nor the notification delay on this claim is outside the normal range.`,
    riskFactors: [
      fraudSignal ? `Fraud score of ${r.fraudScore} clears the ${FRAUD_REFERRAL}-point referral threshold` : null,
      notificationSignal ? `Notification delay of ${r.notificationDelayDays} days is at or beyond the ${NOTIFICATION_CONDITION_DAYS}-day condition` : null,
      !causeRecorded ? 'The liability basis is not yet recorded on the file' : null,
    ]
      .filter((x): x is string => Boolean(x))
      .concat(['Claim has not previously been referred for investigation'])
      .slice(0, 4),
  };
}

function buildConfirmClosure(fd: FormData): TaskSpec {
  const r = resolve(fd);
  const settled = r.settlementOutcome.toLowerCase().includes('settl');
  const reasonRecorded = !isBlank(r.closureReasonCode);
  const recoveryReconciled = r.recoveryAmountReceived <= r.estimatedCost;

  const rules: RuleResult[] = [
    {
      name: 'Settlement reconciled',
      status: settled ? 'pass' : 'fail',
      actual: r.settlementOutcome,
      threshold: 'Settled',
    },
    {
      name: 'Closure reason recorded',
      status: reasonRecorded ? 'pass' : 'fail',
      actual: r.closureReasonCode,
      threshold: 'Recorded',
    },
    {
      name: 'Recovery reconciled against cost',
      status: recoveryReconciled ? 'pass' : 'fail',
      actual: money(r.recoveryAmountReceived),
      threshold: `≤ ${money(r.estimatedCost)}`,
    },
  ];

  const shouldConfirm = settled && reasonRecorded && recoveryReconciled;
  const recommendedOutcomeKey = shouldConfirm ? 'Confirmed' : 'ReturnedForReview';
  const headline = shouldConfirm ? 'Confirm closure' : 'Return for review';
  const lines = shouldConfirm
    ? [
        'Settlement is reconciled and recovery is recorded where applicable.',
        `The closure reason (${r.closureReasonCode}) is on file and the decision ledger is written.`,
      ]
    : [
        !settled
          ? `Settlement is recorded as "${r.settlementOutcome}" rather than settled.`
          : !reasonRecorded
            ? 'No closure reason is recorded against the claim yet.'
            : `Recovery of ${money(r.recoveryAmountReceived)} does not reconcile against the ${money(r.estimatedCost)} cost.`,
        'Something in the record does not stand up yet — send it back before it closes.',
      ];

  return {
    title: 'Confirm Closure',
    coverType: 'Third party liability',
    notesLabel: 'Closure notes',
    notesPlaceholder: 'Anything worth recording against the closed claim.',
    notesRequired: false,
    outcomes: [
      { key: 'ReturnedForReview', label: 'Return for review', variant: 'secondary' },
      { key: 'Confirmed', label: 'Confirm closure', variant: 'primary' },
    ].map((o) => ({ ...o, variant: o.key === recommendedOutcomeKey ? 'primary' : 'secondary' })),
    recommendedOutcomeKey,
    recommendationHeadline: headline,
    recommendationLines: lines,
    metrics: [
      confidenceFromRules(rules),
      rulesMetric(rules),
      { label: 'Precedent matches', value: '4 last 90d' },
    ],
    factTiles: [
      { label: 'Claimant', value: r.claimantName, detail: r.incidentLocation },
      { label: 'Settlement outcome', value: r.settlementOutcome, detail: `${r.settlementBasis.toLowerCase()} basis` },
      {
        label: 'Recovery received',
        value: money(r.recoveryAmountReceived),
        detail: r.contributoryNegligenceFlag ? 'reduction applied' : 'no reduction',
      },
      { label: 'Closure reason', value: r.closureReasonCode, detail: 'proposed reason' },
    ],
    rules,
    notable: shouldConfirm
      ? `Settlement on this claim reconciles cleanly against the ${r.closureReasonCode.toLowerCase()}.`
      : `The closure record on this claim has an open thread worth checking before it closes.`,
    riskFactors: [
      !settled ? `Settlement outcome is "${r.settlementOutcome}", not yet settled` : null,
      !reasonRecorded ? 'No closure reason recorded' : null,
      !recoveryReconciled ? 'Recovery received exceeds the estimated cost on file' : null,
    ]
      .filter((x): x is string => Boolean(x))
      .concat(['Final photograph set was added late to the file'])
      .slice(0, 4),
  };
}

const BUILDERS: Record<string, (fd: FormData) => TaskSpec> = {
  SubmitMedicalEvidence: buildSubmitMedicalEvidence,
  AuthoriseSettlement: buildAuthoriseSettlement,
  AuthoriseSupplementalTreatment: buildAuthoriseSupplementalTreatment,
  AuthoriseInvestigativeRestriction: buildAuthoriseInvestigativeRestriction,
  ConfirmClosure: buildConfirmClosure,
};

export function buildTaskSpec(fd: FormData): TaskSpec {
  const builder = BUILDERS[fd.actionType] ?? buildSubmitMedicalEvidence;
  return builder(fd);
}

/** A stable, non-PII task number derived from the claim reference for display only. */
export function taskNumberFor(claimReference: string): string {
  const digits = claimReference.replace(/\D/g, '');
  if (digits.length >= 6) return digits.slice(-8);
  let hash = 0;
  for (let i = 0; i < claimReference.length; i += 1) {
    hash = (hash * 31 + claimReference.charCodeAt(i)) >>> 0;
  }
  return String(10000000 + (hash % 90000000));
}

export const EVIDENCE_SIGNALS = [
  "Medical expert's report",
  'Treatment and rehabilitation plan',
  'Policy schedule',
  'Accident circumstances report',
  'Loss of earnings schedule',
];
