import { useCallback, useMemo, useState } from 'react';
import {
  QUEUE, INSIGHTS, PILING_UP, LEDGER, SUGGESTIONS,
  type QueueCase, type Suggestion,
} from './demoData';
import { useAuth } from '../hooks/useAuth';
import { useTasks, type LiveTask } from './useTasks';
import Form, { type TaskHost } from '../components/Form';
import './Console.css';

type Persona = 'handler' | 'analyst';
type View = 'queue' | 'insights' | 'ledger' | 'suggestions';

const NAV: Record<Persona, { view: View; label: string }[]> = {
  handler: [
    { view: 'queue', label: 'My queue' },
    { view: 'insights', label: 'Insights' },
  ],
  analyst: [
    { view: 'suggestions', label: 'Suggestions' },
    { view: 'ledger', label: 'Ledger' },
    { view: 'insights', label: 'Insights' },
  ],
};

const PERSONA_META: Record<Persona, { name: string; role: string; initials: string }> = {
  handler: { name: 'Dana Ferris', role: 'Claims Officer', initials: 'DF' },
  analyst: { name: 'Priya Nakamura', role: 'Claims Manager', initials: 'PN' },
};

const money = (n: number) =>
  new Intl.NumberFormat(undefined, { style: 'currency', currency: 'GBP', maximumFractionDigits: 0 }).format(n);

interface ConsoleProps {
  darkTheme: boolean;
  onToggleTheme: () => void;
}

function Console({ darkTheme, onToggleTheme }: ConsoleProps) {
  const [persona, setPersona] = useState<Persona>('handler');
  const [view, setView] = useState<View>('queue');
  const [openCase, setOpenCase] = useState<QueueCase | null>(null);
  const [applied, setApplied] = useState<string[]>([]);
  const [openTask, setOpenTask] = useState<LiveTask | null>(null);
  const [taskData, setTaskData] = useState<Record<string, unknown> | null>(null);

  const { isAuthenticated, isLoading: authLoading, sdk, login, error: authError } = useAuth();
  const { tasks, loading: tasksLoading, error: tasksError, loadTaskData, completeTask } =
    useTasks(sdk, isAuthenticated);

  const switchPersona = (p: Persona) => {
    setPersona(p);
    setView(NAV[p][0].view);
    setOpenCase(null);
    setOpenTask(null);
  };

  const openLiveTask = useCallback(async (task: LiveTask) => {
    const data = await loadTaskData(task);
    setTaskData(data);
    setOpenTask(task);
  }, [loadTaskData]);

  const closeTask = useCallback(() => {
    setOpenTask(null);
    setTaskData(null);
  }, []);

  /** Hosts the action form inside the web app, backed by the Tasks API. */
  const taskHost = useMemo<TaskHost | null>(() => {
    if (!openTask) return null;
    let working: Record<string, unknown> = { ...(taskData ?? {}) };
    return {
      load: async () => ({ data: working as never, isReadOnly: false }),
      save: (d) => { working = d as unknown as Record<string, unknown>; },
      complete: async (outcome, d) => {
        await completeTask(openTask, outcome, d as unknown as Record<string, unknown>);
        closeTask();
        return { success: true };
      },
      onBack: closeTask,
    };
  }, [openTask, taskData, completeTask, closeTask]);

  const who = PERSONA_META[persona];

  if (openTask && taskHost) {
    return (
      <div className="console console--task">
        <main className="console__main console__main--task">
          <Form
            host={taskHost}
            onInitTheme={() => {}}
            darkTheme={darkTheme}
            onToggleTheme={onToggleTheme}
          />
        </main>
      </div>
    );
  }

  return (
    <div className="console">
      <aside className="console__nav">
        <div className="console__brand">
          <span className="console__brand-mark" aria-hidden="true" />
          <span className="console__brand-text">Personal Injury Claims</span>
        </div>

        <nav className="console__links" aria-label="Views">
          {NAV[persona].map((item) => (
            <button
              key={item.view}
              type="button"
              className={`console__link ${view === item.view && !openCase ? 'console__link--on' : ''}`}
              onClick={() => { setView(item.view); setOpenCase(null); }}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="console__persona">
          <div className="console__persona-who">
            <span className="console__avatar" aria-hidden="true">{who.initials}</span>
            <span>
              <span className="console__persona-name">{who.name}</span>
              <span className="console__persona-role">{who.role}</span>
            </span>
          </div>
          <div className="console__persona-switch" role="group" aria-label="Switch persona">
            <button
              type="button"
              className={persona === 'handler' ? 'on' : ''}
              onClick={() => switchPersona('handler')}
            >
              Claims Officer
            </button>
            <button
              type="button"
              className={persona === 'analyst' ? 'on' : ''}
              onClick={() => switchPersona('analyst')}
            >
              Claims Manager
            </button>
          </div>
        </div>
      </aside>

      <main className="console__main">
        <header className="console__top">
          <div>
            <h1 className="console__title">
              {openCase ? openCase.id
                : view === 'queue' ? 'Claims that need you'
                : view === 'insights' ? 'How personal injury claims is running'
                : view === 'ledger' ? 'Decision ledger'
                : 'Suggested improvements'}
            </h1>
            <p className="console__sub">
              {openCase ? `${openCase.claimantName} — ${openCase.incidentLocation}`
                : view === 'queue' ? `${QUEUE.length} of 1,241 claims this month reached a person.`
                : view === 'insights' ? 'Last 30 days.'
                : view === 'ledger' ? 'What was decided, by whom, and the reasoning behind it.'
                : 'Patterns found in real decisions and the rationale behind them.'}
            </p>
          </div>
          <button
            type="button"
            className="console__theme"
            onClick={onToggleTheme}
            aria-label={darkTheme ? 'Switch to light mode' : 'Switch to dark mode'}
          >
            {darkTheme ? '☀' : '☾'}
          </button>
        </header>

        {openCase ? (
          <CaseDetail item={openCase} onBack={() => setOpenCase(null)} />
        ) : view === 'queue' ? (
          <>
            <TaskStrip
              isAuthenticated={isAuthenticated}
              authLoading={authLoading}
              authError={authError}
              onLogin={login}
              tasks={tasks}
              tasksLoading={tasksLoading}
              tasksError={tasksError}
              onOpenTask={openLiveTask}
            />
            <Queue onOpen={setOpenCase} />
          </>
        ) : view === 'insights' ? (
          <Insights />
        ) : view === 'ledger' ? (
          <Ledger />
        ) : (
          <Suggestions applied={applied} onApply={(id) => setApplied((a) => [...a, id])} />
        )}
      </main>
    </div>
  );
}

/**
 * Live action tasks assigned out of the running claim. These are the real
 * thing: opening one renders its coded action form inside this web app.
 */
function TaskStrip({
  isAuthenticated, authLoading, authError, onLogin,
  tasks, tasksLoading, tasksError, onOpenTask,
}: {
  isAuthenticated: boolean;
  authLoading: boolean;
  authError: string | null;
  onLogin: () => Promise<void>;
  tasks: LiveTask[];
  tasksLoading: boolean;
  tasksError: string | null;
  onOpenTask: (t: LiveTask) => void;
}) {
  if (!isAuthenticated) {
    return (
      <section className="panel task-strip">
        <h2 className="panel__title">Live decision tasks</h2>
        <p className="panel__lead">
          Connect to the tenant to work the claim’s real action tasks in here.
        </p>
        <div className="row">
          <button type="button" className="btn btn--primary" onClick={() => void onLogin()} disabled={authLoading}>
            {authLoading ? 'Connecting…' : 'Connect to UiPath'}
          </button>
          {authError && <span className="task-strip__error">{authError}</span>}
        </div>
      </section>
    );
  }

  return (
    <section className="panel task-strip">
      <div className="suggestion__head">
        <h2 className="panel__title">Live decision tasks</h2>
        {tasksLoading && <span className="pill pill--quiet">Loading…</span>}
      </div>
      {tasksError && <p className="task-strip__error">{tasksError}</p>}
      {!tasksLoading && !tasksError && tasks.length === 0 && (
        <p className="panel__lead">
          No pending tasks. When a claim needs a decision, it appears here.
        </p>
      )}
      {tasks.length > 0 && (
        <ul className="task-list">
          {tasks.map((t) => (
            <li key={t.id}>
              <span className="task-list__title">{t.title}</span>
              <button type="button" className="btn btn--primary" onClick={() => onOpenTask(t)}>
                Open task
              </button>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Queue({ onOpen }: { onOpen: (c: QueueCase) => void }) {
  return (
    <div className="stack">
      {QUEUE.map((c) => (
        <article key={c.id} className="case-card">
          <div className="case-card__head">
            <div className="case-card__ident">
              <span className="case-card__id">{c.id}</span>
              <span className={`pill pill--${c.impact.toLowerCase()}`}>{c.impact}</span>
              {c.slaHoursLeft <= 8 && <span className="pill pill--sla">SLA in {c.slaHoursLeft}h</span>}
            </div>
            <span className="case-card__who">{c.claimantName} — {c.incidentLocation}</span>
          </div>

          <p className="case-card__reason">{c.reason}</p>

          <div className="case-card__reco">
            <span className="case-card__reco-label">Recommended</span>
            <span>{c.recommendation}</span>
          </div>

          <div className="case-card__foot">
            <dl className="facts">
              <div><dt>Injury type</dt><dd>{c.peril}</dd></div>
              <div><dt>Liability basis</dt><dd>{c.causeOfLoss}</dd></div>
              <div><dt>Estimated quantum</dt><dd>{money(c.estimatedCost)}</dd></div>
              <div><dt>Notification delay (days)</dt><dd>{c.notificationDelayDays}</dd></div>
            </dl>
            <button type="button" className="btn btn--primary" onClick={() => onOpen(c)}>
              Open claim
            </button>
          </div>
        </article>
      ))}
    </div>
  );
}

function CaseDetail({ item, onBack }: { item: QueueCase; onBack: () => void }) {
  return (
    <div className="stack">
      <button type="button" className="btn btn--ghost btn--back" onClick={onBack}>← Back to queue</button>

      <section className="panel">
        <h2 className="panel__title">Why this reached you</h2>
        <p className="panel__lead">{item.reason}</p>
        <div className="case-card__reco">
          <span className="case-card__reco-label">Recommended</span>
          <span>{item.recommendation}</span>
        </div>
      </section>

      <details className="panel">
        <summary className="panel__title panel__title--toggle">Evidence and reasoning</summary>
        <ul className="bullets">
          <li>{item.causeOfLoss} — {item.peril.toLowerCase()} reported at the accident location.</li>
          <li>Notification delay stands at {item.notificationDelayDays} days against the policy's 30-day reporting condition.</li>
          <li>Treatment and rehabilitation plan and cost estimate assembled from the appointed provider.</li>
          <li>Estimated quantum {money(item.estimatedCost)} against the reserve set at intake.</li>
        </ul>
      </details>

      <details className="panel">
        <summary className="panel__title panel__title--toggle">Claim history</summary>
        <ol className="timeline">
          <li><span>Reported</span> The claimant opened the claim through the portal.</li>
          <li><span>Triaged</span> Injury severity assessed and an injury assessor instructed automatically.</li>
          <li><span>Evidence</span> Medical records bundle, treatment plan and policy schedule gathered.</li>
          <li><span>Liability</span> Policy could not settle it — routed to you.</li>
        </ol>
      </details>

      <section className="panel panel--action">
        <h2 className="panel__title">The decision</h2>
        <p className="panel__lead">
          The task itself opens in Action Center, where the liability or settlement position and rationale are captured.
        </p>
        <div className="row">
          <button type="button" className="btn btn--primary">Open the decision task</button>
          <button type="button" className="btn btn--ghost">Ask the Case Agent</button>
        </div>
      </section>
    </div>
  );
}

export function Insights() {
  return (
    <div className="stack">
      <div className="metrics">
        {INSIGHTS.map((m) => (
          <div key={m.label} className={`metric metric--${m.tone}`}>
            <span className="metric__value">{m.value}</span>
            <span className="metric__label">{m.label}</span>
            <span className="metric__detail">{m.detail}</span>
          </div>
        ))}
      </div>

      <section className="panel">
        <h2 className="panel__title">What keeps piling up</h2>
        <p className="panel__lead">
          The reasons claims stop being autonomous. Each one is a candidate for a rule change.
        </p>
        <table className="table">
          <thead>
            <tr><th>Reason a person was needed</th><th>Claims</th><th>vs. last month</th></tr>
          </thead>
          <tbody>
            {PILING_UP.map((r) => (
              <tr key={r.reason}>
                <td>{r.reason}</td>
                <td className="num">{r.count}</td>
                <td className={`num ${r.trend.startsWith('+') ? 'up' : 'down'}`}>{r.trend}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}

export function Ledger() {
  return (
    <div className="stack">
      {LEDGER.map((e) => (
        <article key={e.caseId} className="ledger-row">
          <div className="ledger-row__head">
            <span className="case-card__id">{e.caseId}</span>
            <span className="case-card__who">{e.customer}</span>
            <span className="ledger-row__when">{e.when}</span>
          </div>
          <p className="ledger-row__decision">{e.decision}</p>
          <blockquote className="ledger-row__rationale">{e.rationale}</blockquote>
          <div className="ledger-row__meta">
            <span>{e.decidedBy}</span>
            <span className="pill pill--quiet">{e.agreement}</span>
          </div>
        </article>
      ))}
    </div>
  );
}

export function Suggestions({ applied, onApply }: { applied: string[]; onApply: (id: string) => void }) {
  return (
    <div className="stack">
      {SUGGESTIONS.map((s: Suggestion) => {
        const isApplied = applied.includes(s.id);
        return (
          <article key={s.id} className={`panel suggestion ${isApplied ? 'suggestion--applied' : ''}`}>
            <div className="suggestion__head">
              <h2 className="panel__title">Pattern found</h2>
              <span className="pill pill--quiet">{s.confidence} confidence</span>
            </div>
            <p className="panel__lead">{s.pattern}</p>
            <p className="suggestion__evidence">{s.evidence}</p>

            <div className="rules">
              <div className="rule rule--old">
                <span className="rule__label">Rule today</span>
                <p>{s.existingRule}</p>
              </div>
              <div className="rule rule--new">
                <span className="rule__label">Proposed</span>
                <p>{s.proposedRule}</p>
              </div>
            </div>

            {isApplied ? (
              <div className="applied-note">
                <strong>Applied.</strong> The next claim matching this pattern settles without waiting for a
                person — {s.casesAffected} claims a month, on current volume. Roll back any time.
              </div>
            ) : (
              <div className="row">
                <button type="button" className="btn btn--primary" onClick={() => onApply(s.id)}>
                  Apply change
                </button>
                <span className="suggestion__impact">
                  Would have settled {s.casesAffected} claims without a person last month.
                </span>
              </div>
            )}
          </article>
        );
      })}
    </div>
  );
}

export default Console;
