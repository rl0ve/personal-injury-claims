import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { useTasks, type LiveTask } from '../console/useTasks';
import { Insights, Ledger, Suggestions } from '../console/Console';
import { specFor, type DecisionSpec } from './decisionSpec';
import { EVIDENCE, COMMENTS, headerFromTask, FALLBACK_HEADER } from './caseContext';
import './Workspace.css';

type Rail = 'actions' | 'insights' | 'ledger' | 'suggestions';

const RAIL: { key: Rail; label: string; glyph: string }[] = [
  { key: 'actions', label: 'My actions', glyph: '☑' },
  { key: 'insights', label: 'Insights', glyph: '◔' },
  { key: 'ledger', label: 'Decision ledger', glyph: '≣' },
  { key: 'suggestions', label: 'Suggestions', glyph: '✦' },
];

/** The storyboard claim, shown when the tenant has no pending task. */
const SAMPLE_TASK: LiveTask = {
  id: -1,
  key: 'sample',
  title: 'Confirm liability position',
  folderId: 0,
  type: 'AppTask' as LiveTask['type'],
  action: null,
  createdTime: new Date(Date.now() - 3 * 3600_000).toISOString(),
  data: null,
};

const SAMPLE_DATA: Record<string, unknown> = {
  actionType: 'SubmitMedicalEvidence',
  claimReference: 'CLAIM-5182',
  claimantName: 'Joseph Thompson',
  incidentLocation: 'Oxford Road at Castle Street, Reading, RG1 7LS',
  injuryTypeCode: 'Whiplash / soft-tissue injury',
  liabilityBasisCode: 'Rear-end collision at a signalised junction',
  liabilityOutcome: 'Covered',
  notificationDelayDays: 18,
  fraudScore: 12,
  estimatedCost: 18400,
  authorityLimit: 25000,
  liabilityCoverInForce: true,
  contributoryNegligenceFlag: false,
  agentRationale:
    'The injury assessor reviewed the claim within 24 hours and found a whiplash-associated disorder consistent with the reported rear-end collision. The IME report describes a single, well-defined injury pattern with no evidence of a pre-existing condition. New medical information is a live question: the claimant reports a flare-up in the last fortnight that the IME report predates, and the updated GP records have been requested but are not yet on file.',
  decisionRationale:
    'Liability sits with the following vehicle and the injury is accident-related. Recommend admitting liability in full and holding the settlement offer until the new medical information arrives.',
};

interface WorkspaceProps {
  darkTheme: boolean;
  onToggleTheme: () => void;
}

function Workspace({ darkTheme, onToggleTheme }: WorkspaceProps) {
  const [rail, setRail] = useState<Rail>('actions');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [taskData, setTaskData] = useState<Record<string, unknown> | null>(null);
  const [applied, setApplied] = useState<string[]>([]);
  const [query, setQuery] = useState('');

  const { isAuthenticated, isLoading: authLoading, sdk, login, error: authError } = useAuth();
  const { tasks, loading, error, loadTaskData, completeTask } = useTasks(sdk, isAuthenticated);

  // When no live task is pending, the workspace still shows the storyboard
  // claim so the decision experience is reviewable. Live tasks always take priority.
  const showing: LiveTask[] = tasks.length > 0 ? tasks : [SAMPLE_TASK];
  const isSample = tasks.length === 0;

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? showing.filter((t) => t.title.toLowerCase().includes(q)) : showing;
  }, [showing, query]);

  const selected = useMemo(
    () => visible.find((t) => t.id === selectedId) ?? null,
    [visible, selectedId],
  );

  // Select the first task automatically, and load its data whenever it changes.
  useEffect(() => {
    if (!selected && visible.length > 0) setSelectedId(visible[0].id);
  }, [selected, visible]);

  useEffect(() => {
    let cancelled = false;
    if (!selected) { setTaskData(null); return; }
    if (selected.id === SAMPLE_TASK.id) { setTaskData(SAMPLE_DATA); return; }
    void loadTaskData(selected).then((d) => { if (!cancelled) setTaskData(d); });
    return () => { cancelled = true; };
  }, [selected, loadTaskData]);

  const submit = useCallback(
    async (outcome: string, data: Record<string, unknown>) => {
      if (!selected) return;
      if (selected.id !== SAMPLE_TASK.id) await completeTask(selected, outcome, data);
      setSelectedId(null);
      setTaskData(null);
    },
    [selected, completeTask],
  );

  return (
    <div className="ws">
      <nav className="ws__rail" aria-label="Sections">
        <span className="ws__logo" aria-hidden="true" />
        {RAIL.map((r) => (
          <button
            key={r.key}
            type="button"
            className={`ws__rail-btn ${rail === r.key ? 'is-on' : ''}`}
            title={r.label}
            aria-label={r.label}
            aria-pressed={rail === r.key}
            onClick={() => setRail(r.key)}
          >
            <span aria-hidden="true">{r.glyph}</span>
          </button>
        ))}
        <button
          type="button"
          className="ws__rail-btn ws__rail-btn--foot"
          onClick={onToggleTheme}
          aria-label={darkTheme ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <span aria-hidden="true">{darkTheme ? '☀' : '☾'}</span>
        </button>
        <span className="ws__me" aria-hidden="true">DF</span>
      </nav>

      {rail === 'actions' ? (
        <>
          <aside className="ws__list">
            <div className="ws__list-head">
              <h2 className="ws__list-title">
                My actions <span className="ws__count">({visible.length})</span>
              </h2>
              <button type="button" className="ws__chip-btn">Filters</button>
            </div>

            <input
              className="ws__search"
              placeholder="Search actions, claims, people…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />

            {loading && <p className="ws__muted">Loading…</p>}
            {error && <p className="ws__err">{error}</p>}

            <p className="ws__assigned">{visible.length} assigned to you</p>
            <p className="ws__group">Blocking ({visible.length})</p>
            <ul className="ws__cards">
              {visible.map((t) => (
                <li key={t.id}>
                  <button
                    type="button"
                    className={`ws__card ${t.id === selectedId ? 'is-on' : ''}`}
                    onClick={() => setSelectedId(t.id)}
                  >
                    <span className="ws__card-title">{t.title}</span>
                    <span className="ws__card-sub">{FALLBACK_HEADER.customer}</span>
                    <span className="ws__card-sub">{FALLBACK_HEADER.caseId}</span>
                    <span className="ws__card-tags">
                      <span className="tag tag--blocking">Blocking</span>
                      <span className="tag tag--p1">P1</span>
                      <span className="ws__card-left">48 min left</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>

            {!isAuthenticated && (
              <div className="ws__connect">
                <p className="ws__muted">
                  {isSample ? 'Showing the storyboard claim. Connect to load live tasks.' : ''}
                </p>
                <button
                  type="button"
                  className="btn-ghost"
                  onClick={() => void login()}
                  disabled={authLoading}
                >
                  {authLoading ? 'Connecting…' : 'Connect to UiPath'}
                </button>
                {authError && <p className="ws__err">{authError}</p>}
              </div>
            )}
          </aside>

          {selected ? (
            <Decision
              task={selected}
              data={taskData}
              onSubmit={submit}
              onOpenConsole={() => setRail('insights')}
            />
          ) : (
            <main className="ws__main ws__main--empty">
              <p className="ws__muted">
                Select an action to review it.
              </p>
            </main>
          )}
        </>
      ) : (
        <main className="ws__main ws__main--wide">
          <div className="ws__secondary">
            {rail === 'insights' ? <Insights />
              : rail === 'ledger' ? <Ledger />
              : <Suggestions applied={applied} onApply={(id) => setApplied((a) => [...a, id])} />}
          </div>
        </main>
      )}
    </div>
  );
}

/* ---- centre pane: the action task itself ------------------------------- */

function Decision({
  task, data, onSubmit, onOpenConsole,
}: {
  task: LiveTask;
  data: Record<string, unknown> | null;
  onSubmit: (outcome: string, data: Record<string, unknown>) => Promise<void>;
  onOpenConsole: () => void;
}) {
  const spec: DecisionSpec = specFor(data?.actionType);
  const header = headerFromTask(data);

  const recommended = spec.options.find((o) => o.support === 'recommended') ?? spec.options[0];
  const [choice, setChoice] = useState<string>(recommended.key);
  const [rationale, setRationale] = useState<string>('');
  const [open, setOpen] = useState<string | null>(EVIDENCE[0].id);
  const [helpful, setHelpful] = useState<Record<string, 'up' | 'down'>>({});
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<'overview' | 'comments'>('comments');
  const [askOpen, setAskOpen] = useState(false);

  // The agent's own reasoning, as carried on the task.
  const reasoning = [
    { label: 'Recommendation and rationale', value: data?.decisionRationale },
    { label: 'Agent supporting rationale', value: data?.agentRationale },
  ].filter((r) => typeof r.value === 'string' && r.value) as { label: string; value: string }[];

  // Reset when a different task is opened, and seed the rationale from the claim.
  useEffect(() => {
    setChoice(recommended.key);
    const seeded = data?.[spec.rationaleKey];
    setRationale(typeof seeded === 'string' ? seeded : '');
    setBusy(false);
  }, [task.id, recommended.key, spec.rationaleKey, data]);

  const blocked = spec.rationaleRequired && rationale.trim().length === 0;

  const send = async (outcome: string) => {
    setBusy(true);
    try {
      await onSubmit(outcome, {
        ...(data ?? {}),
        [spec.rationaleKey]: rationale,
        evidenceHelpful: Object.entries(helpful)
          .filter(([, v]) => v === 'up')
          .map(([k]) => EVIDENCE.find((e) => e.id === k)?.title ?? k)
          .join('; '),
      });
    } catch {
      setBusy(false);
    }
  };

  return (
    <>
      <main className="ws__main">
        <header className="dec__head">
          <div className="dec__head-top">
            <h1 className="dec__title">{spec.title}</h1>
            {header.blocking && <span className="tag tag--blocking">Blocking</span>}
            <span className="tag tag--p1">{header.priority}</span>
            <span className="dec__head-actions">
              <button type="button" className="btn-ghost btn-sm" onClick={onOpenConsole}>
                ⤢ Open console
              </button>
              <button
                type="button"
                className="btn-dark btn-sm"
                aria-expanded={askOpen}
                onClick={() => setAskOpen((o) => !o)}
              >
                ✦ Ask AI
              </button>
            </span>
          </div>
          <p className="dec__sub">{spec.subtitle}</p>
        </header>

        <div className="dec__meta">
          <div><span className="dec__meta-k">Claim</span><a className="dec__link" href="#case">{header.caseId}</a></div>
          <div><span className="dec__meta-k">Due</span><span>{header.due}</span></div>
          <div>
            <span className="dec__meta-k">Assignee</span>
            <span className="dec__assignee">
              <span className="dec__av">{header.assigneeInitials}</span>{header.assignee}
            </span>
          </div>
          <div>
            <span className="dec__meta-k">SLA</span>
            <span>
              {header.slaAtRisk && <span className="tag tag--risk">At risk</span>}
              <span className="dec__sla">{header.slaLabel} · {header.slaElapsed}</span>
            </span>
          </div>
        </div>

        {askOpen && (
          <section className="dec__block ask">
            <div className="ask__head">
              <h2 className="dec__h2">Why the agent recommends this</h2>
              <button type="button" className="ask__close" onClick={() => setAskOpen(false)} aria-label="Close">✕</button>
            </div>
            {reasoning.length > 0 ? (
              <dl className="ask__list">
                {reasoning.map((r) => (
                  <div key={r.label}>
                    <dt>{r.label}</dt>
                    <dd>{r.value}</dd>
                  </div>
                ))}
              </dl>
            ) : (
              <p className="ws__muted">
                This task carries no agent reasoning fields.
              </p>
            )}
            <p className="ask__note">
              Drawn from the reasoning the Case Agent wrote onto this task.
            </p>
          </section>
        )}

        <section className="dec__block">
          <h2 className="dec__h2">What you’re reviewing</h2>
          <ul className="ev">
            {EVIDENCE.map((e) => {
              const isOpen = open === e.id;
              return (
                <li key={e.id} className={`ev__row ${isOpen ? 'is-open' : ''}`}>
                  <div className="ev__bar">
                    <button
                      type="button"
                      className="ev__toggle"
                      aria-expanded={isOpen}
                      onClick={() => setOpen(isOpen ? null : e.id)}
                    >
                      <span className="ev__chev" aria-hidden="true">{isOpen ? '⌄' : '›'}</span>
                      <span className="ev__doc" aria-hidden="true">▤</span>
                      <span className="ev__text">
                        <span className="ev__title">{e.title}</span>
                        <span className="ev__summary">{e.summary}</span>
                      </span>
                    </button>
                    <span className="ev__rate">
                      <button
                        type="button"
                        className={helpful[e.id] === 'up' ? 'is-on' : ''}
                        aria-label="Helpful"
                        onClick={() => setHelpful((h) => ({ ...h, [e.id]: 'up' }))}
                      >👍</button>
                      <button
                        type="button"
                        className={helpful[e.id] === 'down' ? 'is-on' : ''}
                        aria-label="Not helpful"
                        onClick={() => setHelpful((h) => ({ ...h, [e.id]: 'down' }))}
                      >👎</button>
                    </span>
                  </div>
                  {isOpen && (
                    <div className="ev__body">
                      <p>{e.body}</p>
                      <p className="ev__added">Added {e.addedAgo} · {e.addedBy}</p>
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        </section>

        <section className="dec__block dec__decide">
          <div className="dec__decide-head">
            <h2 className="dec__h2">{spec.question}</h2>
            <span className="dec__preselect">Agent recommendation preselected</span>
            {spec.confidence && (
              <span className="tag tag--conf">CONFIDENCE {spec.confidence}</span>
            )}
          </div>

          <div className="opts" role="radiogroup" aria-label={spec.question}>
            {spec.options.map((o) => (
              <label key={o.key} className={`opt ${choice === o.key ? 'is-on' : ''}`}>
                <input
                  type="radio"
                  name={`decision-${task.id}`}
                  value={o.key}
                  checked={choice === o.key}
                  onChange={() => setChoice(o.key)}
                />
                <span className="opt__body">
                  <span className="opt__top">
                    <span className="opt__label">{o.label}</span>
                    {o.support === 'recommended' && <span className="tag tag--reco">RECOMMENDED</span>}
                    {o.support === 'unsupported' && <span className="tag tag--no">NOT SUPPORTED</span>}
                  </span>
                  <span className="opt__why">{o.rationale}</span>
                </span>
              </label>
            ))}
          </div>

          <label className="dec__rationale">
            <span className="dec__rationale-label">{spec.rationaleLabel}</span>
            <textarea
              rows={3}
              value={rationale}
              placeholder={spec.rationalePlaceholder}
              onChange={(e) => setRationale(e.target.value)}
            />
          </label>

          <div className="dec__foot">
            <button
              type="button"
              className="btn-primary"
              disabled={busy || blocked}
              onClick={() => void send(choice)}
              title={blocked ? 'A rationale is required' : undefined}
            >
              {busy ? 'Submitting…' : 'Submit decision'}
            </button>
            {spec.secondary && (
              <button
                type="button"
                className="btn-ghost"
                disabled={busy}
                onClick={() => void send(spec.secondary!.key)}
              >
                {spec.secondary.label}
              </button>
            )}
            <span className="dec__ledger">WRITES TO THE DECISION LEDGER</span>
          </div>
        </section>
      </main>

      <aside className="ws__side">
        <div className="side__head">
          <h2 className="side__title">
            {header.customer} <span className="side__ext" aria-hidden="true">↗</span>
          </h2>
          <p className="side__sub">{header.assetLine}</p>
        </div>
        <div className="side__tabs" role="tablist">
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'overview'}
            className={tab === 'overview' ? 'is-on' : ''}
            onClick={() => setTab('overview')}
          >Overview</button>
          <button
            type="button"
            role="tab"
            aria-selected={tab === 'comments'}
            className={tab === 'comments' ? 'is-on' : ''}
            onClick={() => setTab('comments')}
          >Comments · {COMMENTS.length}</button>
        </div>

        {tab === 'comments' ? (
          <div className="side__body">
            <h3 className="side__h3">Comments</h3>
            <ul className="cmt">
              {COMMENTS.map((c) => (
                <li key={c.id} className="cmt__row">
                  <span className="cmt__av" aria-hidden="true">{c.initials}</span>
                  <div>
                    <p className="cmt__who">
                      <span className="cmt__name">{c.author}</span>
                      <span className="cmt__role">{c.role}</span>
                      <span className="cmt__ago">{c.ago}</span>
                    </p>
                    <p className="cmt__text">
                      {c.highlight ? <mark>{c.text}</mark> : c.text}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
            <div className="cmt__new">
              <input placeholder="Add a comment…" />
              <button type="button" className="btn-primary btn-primary--sm">Comment</button>
            </div>
          </div>
        ) : (
          <div className="side__body">
            <h3 className="side__h3">Overview</h3>
            <dl className="side__facts">
              <div><dt>Claim</dt><dd>{header.caseId}</dd></div>
              <div><dt>Claimant</dt><dd>{header.customer}</dd></div>
              <div><dt>Task</dt><dd>{task.title}</dd></div>
              <div><dt>Raised</dt><dd>{task.createdTime ? new Date(task.createdTime).toLocaleString() : '—'}</dd></div>
            </dl>
          </div>
        )}
      </aside>
    </>
  );
}

export default Workspace;
