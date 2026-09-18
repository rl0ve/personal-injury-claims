import { useState, useEffect, useMemo } from 'react';
import type { ChangeEvent } from 'react';
import {
  buildTaskSpec,
  taskNumberFor,
  defaultFormData,
  EVIDENCE_SIGNALS,
  INSURER_NAME,
  INSURER_SUBTITLE,
  INSURER_INITIAL,
  type FormData,
} from './taskSpec';
import './DecisionForm.css';

/**
 * Where the form is hosted. In Action Center the CodedActionAppService supplies
 * and completes the task; inside the web app the console supplies the task data
 * and completes it through the Tasks API. Same form either way.
 */
export interface TaskHost {
  load: () => Promise<{ data: Partial<FormData> | null; isReadOnly: boolean; isDark?: boolean }>;
  save: (data: FormData) => void;
  complete: (outcome: string, data: FormData) => Promise<{ success: boolean }>;
  /** Rendered above the form when hosted in the console. */
  onBack?: () => void;
}

interface FormProps {
  onInitTheme: (isDark: boolean) => void;
  darkTheme: boolean;
  onToggleTheme: () => void;
  /** Supplied by whichever app is hosting the form. */
  host: TaskHost;
}

const IconDocument = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <path d="M14 2v6h6" />
  </svg>
);

const IconForward = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M15 4l8 8-8 8" />
    <path d="M23 12H4" />
    <path d="M4 4v16" />
  </svg>
);

const IconBranch = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="6" cy="6" r="2.4" />
    <circle cx="6" cy="18" r="2.4" />
    <circle cx="18" cy="12" r="2.4" />
    <path d="M6 8.4V15.6" />
    <path d="M8.2 7.2l7.8 3.6" />
  </svg>
);

const IconOverflow = () => (
  <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor">
    <circle cx="5" cy="12" r="1.9" />
    <circle cx="12" cy="12" r="1.9" />
    <circle cx="19" cy="12" r="1.9" />
  </svg>
);

const IconMoon = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

const IconSun = () => (
  <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="4" />
    <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" />
  </svg>
);

function DecisionForm({ onInitTheme, darkTheme, onToggleTheme, host }: FormProps) {
  const [formData, setFormData] = useState<FormData>(defaultFormData);
  const [isReadOnly, setIsReadOnly] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  /*
    Set once the host has accepted the submission. Nothing used to change on
    success: `submitting` stayed true, the button stayed dim, and the screen sat
    exactly as before, so there was no way to tell a completed submission from a
    hung one. Only failure had a visible state.
  */
  const [submitted, setSubmitted] = useState(false);
  // The document name is captured at submit rather than read back off the
  // form. Going read-only re-seeds the form from the host, which cleared the
  // filename out of the confirmation and left it saying "The records are on
  // CLAIM-5182" without naming the file the officer had just attached.
  const [submittedDocument, setSubmittedDocument] = useState('');
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [helpful, setHelpful] = useState<string[]>([]);

  useEffect(() => {
    let cancelled = false;
    /*
      Once submitted, stop re-seeding. The host rebuilds itself whenever the
      case polls, which re-ran this effect, wiped the attached filename and the
      note back to their defaults, and set isReadOnly back to false — so a
      completed task sat there looking like an empty one.
    */
    if (submitted) return;
    host
      .load()
      .then(({ data, isReadOnly: ro, isDark }) => {
        if (cancelled) return;
        setFormData(data ? { ...defaultFormData, ...data } : defaultFormData);
        setIsReadOnly(ro);
        if (typeof isDark === 'boolean') onInitTheme(isDark);
        setLoaded(true);
      })
      .catch(() => { if (!cancelled) setLoaded(true); });
    return () => { cancelled = true; };
  }, [host, onInitTheme, submitted]);

  const spec = useMemo(() => buildTaskSpec(formData), [formData]);
  const taskNumber = useMemo(() => taskNumberFor(formData.claimReference || spec.title), [formData.claimReference, spec.title]);

  const push = (updated: FormData) => {
    setFormData(updated);
    host.save(updated);
  };

  const handleTextChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    if (isReadOnly) return;
    const { name, value } = e.target;
    push({ ...formData, [name]: value });
  };

  const toggleHelpful = (signal: string) => {
    if (isReadOnly) return;
    const next = helpful.includes(signal)
      ? helpful.filter((s) => s !== signal)
      : [...helpful, signal];
    setHelpful(next);
    push({ ...formData, evidenceHelpful: next.join('; ') });
  };

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    if (isReadOnly) return;
    const file = e.target.files?.[0];
    // Only the name is carried. The browser keeps the bytes; nothing here ever
    // treats this string as a path.
    push({ ...formData, uploadedDocumentName: file ? file.name : '' });
  };

  const notesValue = formData.decisionRationale;
  const notesSatisfied = !spec.notesRequired || notesValue.trim() !== '';
  const uploadSatisfied =
    !spec.upload?.required || (formData.uploadedDocumentName ?? '').trim() !== '';
  const isFormValid = !isReadOnly && !submitted && !submitting && notesSatisfied && uploadSatisfied;

  const complete = async (outcome: string) => {
    if (!isFormValid) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const result = await host.complete(outcome, formData);
      if (result.success) {
        setSubmittedDocument(formData.uploadedDocumentName ?? '');
        setSubmitted(true);
        setIsReadOnly(true);
      }
      if (!result.success) {
        const r = result as { errorCode?: unknown; errorMessage?: unknown };
        setSubmitError(
          `Could not record the decision (${String(r.errorCode ?? 'no code')}): ${String(
            r.errorMessage ?? 'no message returned',
          )}`,
        );
        setSubmitting(false);
      }
    } catch (err) {
      setSubmitError(
        `Could not record the decision: ${err instanceof Error ? err.message : String(err)}`,
      );
      setSubmitting(false);
    }
  };

  const claimRef = formData.claimReference || 'CLAIM-5182';
  const injuryType = formData.injuryTypeCode || 'Whiplash';
  const estimatedCost = formData.estimatedCost || 27400;
  const money = new Intl.NumberFormat(undefined, { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(estimatedCost);

  return (
    <div className="task-app">
      {host.onBack && (
        <button type="button" className="task-back" onClick={host.onBack}>
          ← Back to queue
        </button>
      )}

      {/* 1. Task header bar */}
      <header className="task-header">
        <div className="task-header__titles">
          <h1 className="task-header__title">
            {spec.title} <span className="task-header__number">#{taskNumber}</span>
          </h1>
          <span className={`task-header__pill${submitted ? ' task-header__pill--done' : ''}`}>
            {submitted ? 'Submitted' : isReadOnly ? 'Read only' : 'Pending'}
          </span>
        </div>
        <div className="task-header__actions">
          <button type="button" className="ghost-icon-btn" title="Documents" aria-label="Documents">
            <IconDocument />
          </button>
          <button type="button" className="ghost-icon-btn" title="Forward" aria-label="Forward">
            <IconForward />
          </button>
          <button type="button" className="ghost-icon-btn" title="Branch" aria-label="Branch">
            <IconBranch />
          </button>
          <button
            type="button"
            className="ghost-icon-btn"
            onClick={onToggleTheme}
            title={darkTheme ? 'Switch to light mode' : 'Switch to dark mode'}
            aria-label={darkTheme ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkTheme ? <IconSun /> : <IconMoon />}
          </button>
          <button type="button" className="ghost-icon-btn" title="More" aria-label="More">
            <IconOverflow />
          </button>
        </div>
      </header>

      <div className={`task-body ${loaded ? 'task-body--enter' : ''}`}>
        {/* 2. Brand strip */}
        <section className="brand-strip">
          <div className="brand-strip__tile" aria-hidden="true">{INSURER_INITIAL}</div>
          <div className="brand-strip__names">
            <span className="brand-strip__insurer">{INSURER_NAME}</span>
            <span className="brand-strip__subtitle">{INSURER_SUBTITLE}</span>
          </div>
          <div className="brand-strip__chips">
            <span className="chip">{claimRef}</span>
            <span className="chip">{injuryType}</span>
            <span className="chip">{money}</span>
            <span className="chip">{spec.coverType}</span>
          </div>
          <span className="status-pill">
            <span className="status-pill__dot" aria-hidden="true" />
            {submitted ? 'Evidence submitted' : isReadOnly ? 'Read only' : 'Awaiting evidence'}
          </span>
        </section>

        {/*
          3. What the case agent has established.

          Called a recommendation while this screen was a four-outcome coverage
          decision. It is not one now: there is a single Submit, and the agent's
          job here is to say what the claim is waiting on, not to propose a
          verdict for someone to accept.
        */}
        <section className="reco-card">
          <p className="reco-card__eyebrow">What the case agent has established</p>
          <h2 className="reco-card__headline">{spec.recommendationHeadline}</h2>
          {spec.recommendationLines.map((line, i) => (
            <p className="reco-card__line" key={i}>{line}</p>
          ))}
          <div className="reco-card__metrics">
            {spec.metrics.map((m) => (
              <div className="reco-metric" key={m.label}>
                <span className="reco-metric__label">{m.label}</span>
                <span className="reco-metric__value">{m.value}</span>
              </div>
            ))}
          </div>
        </section>

        {/* 4. Fact tiles */}
        <section className="fact-tiles">
          {spec.factTiles.map((tile) => (
            <div className="fact-tile" key={tile.label}>
              <span className="fact-tile__label">{tile.label}</span>
              <span className="fact-tile__value">{tile.value}</span>
              <span className="fact-tile__detail">{tile.detail}</span>
            </div>
          ))}
        </section>

        {/* 5. Two-column body */}
        <div className="task-columns task-columns--single">
          {/*
            Rule results, Notable and Risk factors all came from the coverage
            decision this screen used to be. On a task whose only job is to
            attach the provider's records and submit, six green PASS rows argue
            a verdict nobody is being asked for, and the two side cards restate
            the headline. What is left is the claim, what the agent established,
            and the upload.
          */}
          <div className="side-cards">
            {spec.upload && (
              <section className="side-card">
                <div className="side-card__title-row">
                  <h3 className="side-card__title">{spec.upload.label}</h3>
                  <span className="side-card__optional">
                    {spec.upload.required ? 'Required' : 'Optional'}
                  </span>
                </div>
                <p className="upload-hint">{spec.upload.hint}</p>
                <label className="upload-drop">
                  <input
                    type="file"
                    className="upload-input"
                    onChange={handleFileChange}
                    disabled={isReadOnly}
                  />
                  <span className="upload-cta">
                    {formData.uploadedDocumentName
                      ? formData.uploadedDocumentName
                      : 'Choose a file'}
                  </span>
                </label>
              </section>
            )}

            <section className="side-card">
              <div className="side-card__title-row">
                <h3 className="side-card__title">Reviewer comment</h3>
                <span className="side-card__optional">{spec.notesRequired ? 'Required' : 'Optional'}</span>
              </div>
              <textarea
                className="reviewer-textarea"
                name="decisionRationale"
                rows={4}
                placeholder={spec.notesPlaceholder}
                value={notesValue}
                onChange={handleTextChange}
                readOnly={isReadOnly}
              />
              <div className="evidence-row">
                <span className="evidence-row__label">Evidence used</span>
                <div className="signal-chips">
                  {EVIDENCE_SIGNALS.map((signal) => (
                    <button
                      type="button"
                      key={signal}
                      className={`signal-chip ${helpful.includes(signal) ? 'signal-chip--on' : ''}`}
                      onClick={() => toggleHelpful(signal)}
                      disabled={isReadOnly}
                    >
                      {signal}
                    </button>
                  ))}
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>

      {/*
        6a. The confirmation.

        A submission that reaches the case is the whole point of this screen, so
        it says so in the flow of the page rather than only in a pill at the
        top. It names the document, because "Submitted" on its own does not tell
        the officer that the right file went.
      */}
      {submitted && (
        <div className="task-submitted" role="status">
          <span className="task-submitted__title">Evidence submitted to the case</span>
          <span className="task-submitted__body">
            {submittedDocument
              ? `${submittedDocument} is on ${claimRef}. `
              : `The records are on ${claimRef}. `}
            The case agent picks it up from here and decides what happens next.
          </span>
        </div>
      )}

      {/* 6. Outcome buttons */}
      {submitError && (
        <div className="task-submit-error" role="alert">
          {submitError}
        </div>
      )}
      <div className="task-buttons">
        {/* The reason the buttons are disabled belongs beside them. In the body
            the sticky bar covers it, which is how it read as an overlap. */}
        {!submitted && spec.upload?.required && !uploadSatisfied && (
          <span className="reviewer-required">Attach {spec.upload.label.toLowerCase()} before submitting.</span>
        )}
        {!submitted && spec.notesRequired && notesValue.trim() === '' && (
          <span className="reviewer-required">Add a note before submitting.</span>
        )}
        {submitted && <span className="reviewer-required">This task is complete.</span>}
        {spec.outcomes.map((outcome) => (
          <button
            type="button"
            key={outcome.key}
            className={`outcome-btn outcome-btn--${outcome.variant}`}
            onClick={() => complete(outcome.key)}
            disabled={!isFormValid}
          >
            {outcome.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default DecisionForm;
