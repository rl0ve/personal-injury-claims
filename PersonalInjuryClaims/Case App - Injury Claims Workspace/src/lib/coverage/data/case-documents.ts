/**
 * THE DOCUMENTS THE CASE RESTS ON — the seven things a reviewer can open and check.
 *
 * The fifth contract in this folder, and the split from its neighbours is the one
 * they already argue for each other:
 *
 *  - `./decision-signals.ts` is the EVIDENCE a position rests on — a reading.
 *  - `./coverage-decision.ts` is the DECISION and its options.
 *  - `./canned-responses.ts` is what the reviewer has not said yet.
 *  - this file is the SOURCE MATERIAL: the papers the reading was taken from.
 *
 * A signal and a document are not the same object and collapsing them would lose
 * the distinction that matters most here. A signal is an argument — "the seatbelt
 * finding lands on exactly the damages the reduction touches" — and carries an
 * importance, a thing it backs, and anchors on screen. A document is a PDF with an
 * issuer and a page count, and its whole claim is that it exists and says what it
 * says. The widget shows both, in two sections, because "what did you conclude" and
 * "what did you read" are two questions.
 *
 * ## Where these came from, and why they are authored here
 *
 * They are the seven attached to CLAIM-5182 in the claims console's own case
 * data, and they used to be rendered by that app on the decision page — a second
 * evidence surface on a screen whose assistant already answers "where did this come
 * from?". They moved into the widget, and the data moved here rather than being read
 * across: the widget is shared by all three views in this space, and importing from
 * `@pccr/*` would make this repo's assistant depend on a copied application. The
 * embedding exists precisely so that dependency runs one way.
 *
 * The consequence, worth stating: all three views now show this section, because the
 * widget reads module data rather than per-view props. That is coherent — every one
 * of them is CLAIM-5182 and these are that case's documents.
 *
 * **Authored and pure.** No clock, no counters, no reader state — `/signal-collector`
 * is prerendered, and a value that differed between build and hydration would be a
 * mismatch. Which documents have been OPENED is runtime state and belongs beside the
 * render.
 */

/**
 * Where the PDFs are served from.
 *
 * `public/documents/`, which is where this app's own demo set already points its
 * `fileUrl`s — the same seven files, so nothing was copied in for this screen.
 *
 * BARE AND RELATIVE, with no leading slash, because that is this app's
 * convention: the mount point is applied at the point of use by `assetUrl()`
 * (../../app-base.ts), which is what lets a document open from any route depth
 * and from a UiPath Coded App served under `/<routing-name>/`. The embedded copy
 * this came from hardcoded `/claims-console/documents` instead, since Next
 * serves `public/` from a fixed prefix and there was no mount point to read.
 */
const DOCS = "documents";

export interface CaseDocument {
  /** Unique — the React key. */
  id: string;
  /** What to print. The document's own name, not a description of it. */
  title: string;
  /** Who produced it. Half of these are not ours, which is the point of showing it. */
  issuer: string;
  /** Pages, for the reader deciding whether to open it now or later. */
  pages: number;
  /** Served from `public/`; opens in a new tab. */
  href: string;
  /**
   * What was read off it, in one line — or `null` where it is reference material
   * rather than a finding.
   *
   * The field that stops this being a file list. A row saying only "Third-party
   * report · 2pp" tells a reviewer nothing about why it is in the pile; this says
   * what it contributed. `null` is honest for the SOP and the policy schedule:
   * nothing was extracted from them, they are what the case is tested against.
   */
  readOff: string | null;
}

/**
 * In the order the case assembled them: what the examining clinician found, what
 * the policy says, what treatment is planned, what the injury has cost in earnings,
 * how the accident happened, the procedure the claim is judged by, and the medical
 * bundle holding all of it.
 */
export const CASE_DOCUMENTS: CaseDocument[] = [
  {
    id: "doc-loss-adjuster-report",
    title: "IME report",
    issuer: "Aldergate Personal Injury · Independent Medical Examination",
    pages: 3,
    href: `${DOCS}/ime-report.pdf`,
    readOff:
      "Cervical soft-tissue injury and fractured left wrist; seatbelt not worn, severity attributed in part to that",
  },
  {
    id: "doc-policy-schedule",
    title: "Policy schedule extract",
    issuer: "Aldergate Personal Injury",
    pages: 2,
    href: `${DOCS}/policy-schedule-extract.pdf`,
    readOff: null,
  },
  {
    id: "doc-scope-of-works",
    title: "Treatment and rehabilitation plan",
    issuer: "Provider Network · Approved Rehabilitation Provider",
    pages: 3,
    href: `${DOCS}/treatment-and-rehabilitation-plan.pdf`,
    readOff: "Twelve physiotherapy sessions and a graded return-to-work plan, £4,900 estimated",
  },
  {
    id: "doc-contents-schedule",
    title: "Loss of earnings schedule",
    issuer: "Joseph Thompson",
    pages: 2,
    href: `${DOCS}/loss-of-earnings-schedule.pdf`,
    readOff: "14 weeks of certified absence evidenced by payslips, £24,500 total claimed",
  },
  {
    id: "doc-intake-notification",
    title: "Accident circumstances report",
    issuer: "Aldergate Personal Injury · Claims Intake Centre",
    pages: 1,
    href: `${DOCS}/accident-circumstances-report.pdf`,
    readOff: "Third-party vehicle pulled out of a side road; liability disputed by the third-party insurer",
  },
  {
    id: "doc-sop",
    title: "Personal Injury Claims SOP v3",
    issuer: "Aldergate Personal Injury",
    pages: 3,
    href: `${DOCS}/personal-injury-claims-SOP-v3.pdf`,
    readOff: null,
  },
  {
    id: "doc-drying-certificate",
    title: "Medical records bundle",
    issuer: "Provider Network · GP Practice",
    pages: 2,
    href: `${DOCS}/medical-records-bundle.pdf`,
    readOff: "GP records to date; updated records and the revised IME addendum still outstanding",
  },
];

/**
 * How many of the seven contributed a finding.
 *
 * Derived rather than written down, so adding a document changes the count the
 * widget prints without anybody editing a second place — the rule this folder keeps
 * for `CLAIM_TOTAL` and `signalTally`.
 */
export function documentTally(docs: CaseDocument[] = CASE_DOCUMENTS): {
  total: number;
  read: number;
} {
  return { total: docs.length, read: docs.filter((d) => d.readOff !== null).length };
}
