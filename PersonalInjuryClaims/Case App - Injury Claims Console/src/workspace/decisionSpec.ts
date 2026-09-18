/**
 * Per-action-type decision specs for the action workspace.
 *
 * The outcome `key` values are the same semantic strings the deployed action
 * app declares as outcomes, so completing a task writes the outcome straight
 * onto the claim variable bound to the task's `Action` output.
 *
 * `support` drives the label beside each option: the agent marks which options
 * the evidence does and does not support, and preselects its recommendation.
 */

export type Support = 'recommended' | 'supported' | 'unsupported';

export interface DecisionOption {
  key: string;
  label: string;
  support: Support;
  /** One line on why the evidence supports — or does not support — this choice. */
  rationale: string;
}

export interface DecisionSpec {
  /** Shown as the task heading. */
  title: string;
  /** Sits under the heading. */
  subtitle: string;
  question: string;
  options: DecisionOption[];
  rationaleLabel: string;
  rationalePlaceholder: string;
  rationaleRequired: boolean;
  /** Field on the task data that holds the rationale text. */
  rationaleKey: string;
  confidence?: 'LOW' | 'MEDIUM' | 'MEDIUM-HIGH' | 'HIGH';
  /** Secondary action, rendered as an outline button beside Submit. */
  secondary?: { key: string; label: string };
}

export const DECISIONS: Record<string, DecisionSpec> = {
  SubmitMedicalEvidence: {
    title: 'Confirm liability position',
    subtitle: 'Liability assessment and evidence review',
    question: 'Confirm liability position',
    options: [
      {
        key: 'Declined',
        label: 'Deny liability',
        support: 'unsupported',
        rationale: 'Not supported: the mechanism of injury and the medical records both place this within cover.',
      },
      {
        key: 'RightsReserved',
        label: 'Reserve rights pending new medical information',
        support: 'supported',
        rationale: 'Defensible while the updated medical records are still outstanding against the reported flare-up.',
      },
      {
        key: 'CoveredWithAverage',
        label: 'Admit liability with a contributory negligence reduction',
        support: 'supported',
        rationale: 'Applies only if the accident circumstances show the claimant contributed — not indicated here.',
      },
      {
        key: 'Covered',
        label: 'Admit liability in full',
        support: 'recommended',
        rationale:
          'The rear-end collision puts fault on the following vehicle. The GP records show a first presentation within 36 hours, which does not cross the 30-day notification condition.',
      },
    ],
    rationaleLabel: 'Rationale · recorded on the claim',
    rationalePlaceholder: 'Record why you decided this way. This goes on the record.',
    rationaleRequired: true,
    rationaleKey: 'decisionRationale',
    confidence: 'MEDIUM-HIGH',
  },

  AuthoriseSettlement: {
    title: 'Authorise settlement',
    subtitle: 'Quantum assessment and settlement review',
    question: 'Authorise the settlement?',
    options: [
      {
        key: 'Rejected',
        label: 'Reject the settlement',
        support: 'unsupported',
        rationale: 'Not supported: the liability basis and the quantum breakdown both stand up to review.',
      },
      {
        key: 'Referred',
        label: 'Refer above your authority',
        support: 'supported',
        rationale: 'Defensible if the settlement sits above your delegated authority limit.',
      },
      {
        key: 'Partial',
        label: 'Approve part of the quantum',
        support: 'supported',
        rationale: 'Defensible if only the special damages are agreed at this stage.',
      },
      {
        key: 'Approved',
        label: 'Approve the settlement',
        support: 'recommended',
        rationale:
          'General and special damages are itemised and reasonable, the total sits within your authority limit, and the settlement matches the IME findings.',
      },
    ],
    rationaleLabel: 'Rationale · recorded on the claim',
    rationalePlaceholder: 'Record why you decided this way. This goes on the record.',
    rationaleRequired: true,
    rationaleKey: 'decisionRationale',
    confidence: 'HIGH',
  },

  AuthoriseSupplementalTreatment: {
    title: 'Authorise revised quantum',
    subtitle: 'Additional care and rehabilitation cost',
    question: 'Authorise the revised quantum?',
    options: [
      {
        key: 'Refused',
        label: 'Refuse the revised quantum',
        support: 'unsupported',
        rationale: 'Not supported: the additional treatment is directly attributable to the accident-related injury.',
      },
      {
        key: 'ReferToAdjuster',
        label: 'Refer to the injury assessor',
        support: 'supported',
        rationale: 'Defensible if the revision needs a second medical opinion before the additional cost is committed.',
      },
      {
        key: 'Authorised',
        label: 'Authorise the revised quantum',
        support: 'recommended',
        rationale: 'The additional treatment follows directly from the assessed injury and stays inside a reasonable rehabilitation plan.',
      },
    ],
    rationaleLabel: 'Rationale · recorded on the claim',
    rationalePlaceholder: 'Record why you decided this way. This goes on the record.',
    rationaleRequired: false,
    rationaleKey: 'decisionRationale',
    confidence: 'MEDIUM',
  },

  AuthoriseInvestigativeRestriction: {
    title: 'Authorise investigative restriction',
    subtitle: 'Restricting the claim pending SIU investigation',
    question: 'Authorise the restriction?',
    options: [
      {
        key: 'Refused',
        label: 'Refuse the restriction',
        support: 'supported',
        rationale: 'Defensible if the fraud score and the notification delay do not clear the threshold for restricting the claim.',
      },
      {
        key: 'Authorised',
        label: 'Authorise the restriction',
        support: 'recommended',
        rationale: 'The fraud score and the pattern of late-reported treatment together justify holding the claim open pending SIU investigation.',
      },
    ],
    rationaleLabel: 'Rationale · recorded on the claim',
    rationalePlaceholder: 'Record why you decided this way. This goes on the record.',
    rationaleRequired: true,
    rationaleKey: 'decisionRationale',
    confidence: 'MEDIUM-HIGH',
  },

  ConfirmClosure: {
    title: 'Confirm closure',
    subtitle: 'Claim closure',
    question: 'Close the claim?',
    options: [
      {
        key: 'ReturnedForReview',
        label: 'Return for review',
        support: 'supported',
        rationale: 'Something in the record — the late physiotherapy discharge notes, most likely — does not stand up yet.',
      },
      {
        key: 'Confirmed',
        label: 'Confirm closure',
        support: 'recommended',
        rationale: 'Settlement is reconciled, recovery is recorded where applicable, and the decision ledger is written.',
      },
    ],
    rationaleLabel: 'Closure notes · recorded on the claim',
    rationalePlaceholder: 'Anything worth recording against the closed claim.',
    rationaleRequired: false,
    rationaleKey: 'decisionRationale',
    confidence: 'HIGH',
  },
};

export const FALLBACK_DECISION: DecisionSpec = {
  title: 'Review and decide',
  subtitle: 'Claim decision',
  question: 'Your decision',
  options: [
    { key: 'Approved', label: 'Approve', support: 'recommended', rationale: 'Proceed as recommended.' },
    { key: 'Rejected', label: 'Reject', support: 'supported', rationale: 'Send the claim back.' },
  ],
  rationaleLabel: 'Rationale · recorded on the claim',
  rationalePlaceholder: 'Record why you decided this way.',
  rationaleRequired: false,
  rationaleKey: 'decisionRationale',
};

export const specFor = (actionType: unknown): DecisionSpec =>
  (typeof actionType === 'string' && DECISIONS[actionType]) || FALLBACK_DECISION;
