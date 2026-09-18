import { useState, useCallback, useEffect } from 'react';
import Form from './components/Form';
import Workspace from './workspace/Workspace';
import { codedActionAppService } from './uipath';
import './App.css';

/**
 * One codebase, two hosts.
 *
 * Inside Action Center a task is present, so the decision form renders on its
 * own. On the web the app is the driver: the action workspace lists the
 * claim's live tasks and hosts the same decision inside itself. The probe is
 * time-boxed because outside Action Center `getTask()` may never settle.
 */

type Mode = 'probing' | 'task' | 'workspace';

const PROBE_TIMEOUT_MS = 1200;

function App() {
  const [darkTheme, setDarkTheme] = useState(false);
  const [mode, setMode] = useState<Mode>('probing');

  const handleInitTheme = useCallback((isDark: boolean) => setDarkTheme(isDark), []);
  const toggleTheme = useCallback(() => setDarkTheme((d) => !d), []);

  useEffect(() => {
    document.body.className = darkTheme ? 'dark' : 'light';
  }, [darkTheme]);

  useEffect(() => {
    let settled = false;
    const decide = (next: Mode) => {
      if (!settled) { settled = true; setMode(next); }
    };
    const timer = window.setTimeout(() => decide('workspace'), PROBE_TIMEOUT_MS);
    codedActionAppService
      .getTask()
      .then((task) => decide(task ? 'task' : 'workspace'))
      .catch(() => decide('workspace'))
      .finally(() => window.clearTimeout(timer));
    return () => window.clearTimeout(timer);
  }, []);

  if (mode === 'probing') {
    return (
      <div className={`app-shell ${darkTheme ? 'dark' : 'light'}`}>
        <div className="app-probe" role="status">Loading…</div>
      </div>
    );
  }

  return (
    <div className={`app-shell ${darkTheme ? 'dark' : 'light'}`}>
      {mode === 'task' ? (
        <Form onInitTheme={handleInitTheme} darkTheme={darkTheme} onToggleTheme={toggleTheme} />
      ) : (
        <Workspace darkTheme={darkTheme} onToggleTheme={toggleTheme} />
      )}
    </div>
  );
}

export default App;
