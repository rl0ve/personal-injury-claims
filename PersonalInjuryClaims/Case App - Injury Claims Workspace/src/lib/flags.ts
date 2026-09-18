import { useSyncExternalStore } from "react";

// Demo feature flags.
//
// Presenter switches, not product configuration: things worth turning off
// mid-rehearsal to see how a beat lands without them. They persist to
// localStorage. Unlike the case session state, which resets on reload, a
// presenter setting the room up should not have to set these again on refresh.

export interface FeatureFlags {
  /**
   * Run on the bundled demo dataset instead of the live tenant.
   *
   * On by default: the app opens in the state it can always be trusted in, with the
   * storyboard's exact numbers, no sign-in, nothing that depends on a tenant
   * being up. Turn it off to go live, which is also what arms the overlay and
   * every link out to Maestro.
   *
   * The demo set stays the fallback either way: no tenant, no sign-in, or a
   * failed read all land back here.
   */
  useMocks: boolean;
  /**
   * Keep the demo dataset as the spine and paint the live tenant over it.
   *
   * The two sources carry different things. The demo set carries the story:
   * the claimant, the injury, the evidence, the combined-cause argument. The
   * the tenant carries what is actually true right now: which stage the case
   * reached, the instance and task ids, the links that open the real run. On,
   * you get both: the storyboard's case, wired to a live instance, so "open the
   * case run" lands somewhere real and a decision completes a real task.
   *
   * Off, the two never mix: a successful read shows only what the tenant has,
   * and a failed one falls back to the demo set whole. That is the honest
   * setting; this one is the demonstrable setting, which is why it leads.
   *
   * Ignored while `useMocks` is on, since there is nothing live to overlay, which
   * is the shipped state. Turning demo data off is what brings this into play.
   */
  overlayMocks: boolean;
  /**
   * Show the second, opposing cause on the decision console.
   *
   * On, the finding reads as a genuine combined cause: two established causes
   * pointing at different payers, which is the whole reason a person is looking
   * at it. Off, only the covering cause shows, and the case reads as a
   * straightforward approval. Useful for contrasting the two.
   */
  showOpposingCause: boolean;
  /** Show the agent's confidence percentage and precedent rollup. */
  showAgentConfidence: boolean;
  /**
   * Show the reasoning tri-state under the decision.
   *
   * Off by default. It asks the signer to grade the agent's reasoning as well
   * as make the call, and the assessment rail already collects that, per
   * signal, with a thumb, which is the more useful shape of the same feedback.
   */
  showReasoningCapture: boolean;
  /**
   * Show the Case plans entry in the left nav.
   *
   * Off by default: the case plan is design-time material, and the demo's Act
   * III is about running work. The route stays reachable by URL either way, so
   * a presenter can deep-link to it without turning the nav item on.
   */
  showCasePlans: boolean;
  /**
   * Show the morning brief above the work queue.
   *
   * The queue answers "what is waiting"; the brief answers "what happened
   * overnight and what should I do first", which is the question the app is
   * actually opened with. When on, it also absorbs the standalone agent-summary
   * card rather than saying the same thing twice.
   */
  showHomepageSplash: boolean;
  /**
   * Lay the Actions pane out like the console, finding and decision side by
   * side, when there is room for it.
   *
   * On by default, so Actions reads the way the console does. "When there is
   * room" is not decoration: the case-details panel takes the same horizontal
   * space, so with that panel open the pane falls back to the stacked layout
   * regardless. Two columns squeezed into a third of the window is worse than
   * one.
   */
  actionSideBySide: boolean;
  /**
   * Collapse the finding's two causes into one row each.
   *
   * On, each cause is a line: which side it lands on, what it is, and the one
   * clause that establishes it, with the full argument, the provenance stamp
   * and the sources an expand away. That is about a hundred words less on a
   * pane already competing with the decision card, and it keeps the two sides
   * beside each other in the narrow Actions layout, where the cards stack.
   *
   * Off, the original two cards come back. Worth having as a switch rather than
   * a rewrite: the cards make the combined cause land harder on a projector,
   * and the rows read better for someone actually working the queue.
   */
  compactFinding: boolean;
  /**
   * Send the case header's task button to the Actions queue.
   *
   * The button is the same either way, reading "3 open tasks", and only where it
   * lands changes. Off, it opens the decision itself, which is the shorter
   * path and the one the demo takes. On, it goes to the queue, which is where
   * someone working a shift would start and which shows the case's tasks
   * alongside everything else waiting.
   *
   * Off by default: from a case you already have in front of you, a queue is a
   * detour.
   */
  useActions: boolean;
  /**
   * Swap the coverage decision for the CI build of the screen.
   *
   * On, /cases/CLAIM-5182/tasks/coverage-decision renders the rebuilt single
   * reading column: the case and the finding established about it, then the
   * decision with the evidence it rests on underneath it, then this claimant,
   * the precedent and the documents, folded. Off, the two-column console with
   * the sticky decision card comes back unchanged.
   *
   * On by default. Only CLAIM-5182 has an evidence set authored for it
   * (`coverageFixtureFor` in ./coverage/fixture.ts), so every other case keeps
   * the existing console either way rather than opening a page that has to
   * apologise for having nothing to show.
   */
  ciCoverageDecision: boolean;
}

export const DEFAULT_FLAGS: FeatureFlags = {
  // Live by default. The tenant is published and the case is running, so the
  // queue should show what is actually true; a failed read still falls back to
  // the bundled dataset, so there is no blank screen to apologise for.
  useMocks: false,
  // Off: the queue leads with the work rather than a summary of it.
  // The brief is still one toggle away for a presenter who wants the framing.
  // The demo queue keeps the story; the live tenant supplies the ids, stages,
  // links and tasks. The newest running instance lands on the first case, so
  // the top row of the queue IS the Maestro run and its decision completes the
  // real task.
  overlayMocks: true,
  showOpposingCause: true,
  showAgentConfidence: true,
  showReasoningCapture: false,
  showCasePlans: false,
  showHomepageSplash: false,
  actionSideBySide: true,
  compactFinding: true,
  useActions: false,
  ciCoverageDecision: true,
};

export const FLAG_LABELS: Record<keyof FeatureFlags, { label: string; hint: string }> = {
  useMocks: {
    label: "Use demo data",
    hint: "Ignore the live tenant and run on the bundled dataset. On by default; turn it off to go live.",
  },
  overlayMocks: {
    label: "Overlay mock on live",
    hint: "Keep the demo queue and pull real stage state, ids, links and tasks over it. Needs demo data off.",
  },
  showOpposingCause: {
    label: "Opposing cause tile",
    hint: "The second cause, on the claimant. Off, the case reads as a clean approval.",
  },
  showAgentConfidence: {
    label: "Agent confidence",
    hint: "The percentage and the precedent rollup on the assessment.",
  },
  showReasoningCapture: {
    label: "Reasoning capture",
    hint: "The agree / keep asking / stop asking tri-state under the decision. Off by default.",
  },
  showCasePlans: {
    label: "Case plans tab",
    hint: "The design-time case plan and its rules. Off by default; /case-plans still works.",
  },
  showHomepageSplash: {
    label: "Morning brief",
    hint: "The overnight summary, trend tiles and pulse cards above the work queue.",
  },
  useActions: {
    label: "Use actions",
    hint: "Send a case's task button to the Actions queue instead of straight to the decision. Off by default.",
  },
  compactFinding: {
    label: "Compact finding",
    hint: "One row per cause, detail on expand. Off, the two full cause cards come back.",
  },
  actionSideBySide: {
    label: "Side-by-side action",
    hint: "Finding and decision in two columns, like the console. Stacks anyway while the case panel is open.",
  },
  // LAST, and the position is the point: the panel renders
  // `Object.keys(FLAG_LABELS)` in order, so this is what puts the row at the end
  // of the nav's list.
  ciCoverageDecision: {
    label: "CI Coverage decision",
    hint: "Showcase the coverage decision page for CI",
  },
};

/**
 * Flags the current combination makes inert, and what is overriding them.
 *
 * Some of these switches are not independent. Demo data and the overlay are the
 * clearest pair: with demo data on there is no live read at all, so there is
 * nothing for the overlay to paint on, and leaving its toggle looking live
 * invites someone to flip it mid-demo and conclude the app is broken. The data
 * layer already resolves the precedence; this is how the UI says so out loud.
 */
export function suppressedFlags(
  flags: FeatureFlags,
): Partial<Record<keyof FeatureFlags, string>> {
  const suppressed: Partial<Record<keyof FeatureFlags, string>> = {};
  if (flags.useMocks) {
    suppressed.overlayMocks = "Overridden by Use demo data. Nothing live to overlay.";
  }
  return suppressed;
}

/**
 * True when the app may show links out to the tenant: a case run, a task, a
 * job. Demo rows point at nothing, and a dead "Open case run" reads as a bug.
 */
export function liveLinksAllowed(flags: FeatureFlags): boolean {
  return !flags.useMocks;
}

const STORAGE_KEY = "injury-claims-app-flags";

function read(): FeatureFlags {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_FLAGS;
    const parsed = JSON.parse(raw) as Partial<FeatureFlags>;
    // Spread over the defaults so a flag added later is on for everyone who
    // already has a stored object, rather than silently undefined.
    return { ...DEFAULT_FLAGS, ...parsed };
  } catch {
    return DEFAULT_FLAGS;
  }
}

let snapshot: FeatureFlags = read();
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function setFlag<K extends keyof FeatureFlags>(key: K, value: FeatureFlags[K]) {
  snapshot = { ...snapshot, [key]: value };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch {
    /* a presenter in a private window still gets the flag for this session */
  }
  listeners.forEach((l) => l());
}

export function resetFlags() {
  snapshot = DEFAULT_FLAGS;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
  listeners.forEach((l) => l());
}

export function useFlags(): FeatureFlags {
  return useSyncExternalStore(
    subscribe,
    () => snapshot,
    () => DEFAULT_FLAGS,
  );
}

/** True when anything differs from the shipped defaults, which surfaces a reset. */
export function isModified(flags: FeatureFlags): boolean {
  return (Object.keys(DEFAULT_FLAGS) as (keyof FeatureFlags)[]).some(
    (key) => flags[key] !== DEFAULT_FLAGS[key],
  );
}
