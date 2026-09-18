# Warranty Resolution Case App

The Maestro Case App for Industrial Equipment Warranty Resolution: the work queue, the
decision console, the case agent's reassessment, and the execution trail.

Runs on a bundled demo dataset with no UiPath tenant configured, and reads live Maestro case
instances once one is. See [`../AGENTS.md`](../AGENTS.md) for the demo script this implements
and how the case design, storyboard and SDD relate.

## Stack

- **Vite 7 + React 19 + TypeScript**
- **Apollo Vertex Shell**, vendored into `src/components/ui/` from the Vertex registry.
  Tailwind CSS 4 via `@tailwindcss/vite`; theme tokens in `src/index.css`.
- **TanStack Router** (required by the Shell) + **TanStack Query**
- **`@uipath/uipath-typescript`** for OAuth, case instances, stages, variables, execution
  history, Action Center tasks, Data Fabric

## Run it

```bash
npm install
npm run dev              # http://localhost:5173 → redirects to /cases
npm run build            # root-hosted build, absolute /assets
npm run build:uipath     # UiPath Coded Apps build, relative ./assets
npm run preview
```

Deploy with [`../deploy-app.sh`](../deploy-app.sh).

## Structure

```
src/
  router.tsx                    routes + the shell; providers on the root route
  lib/warranty/
    casePlan.ts                 THE case shape: stages, tasks, actors, SLAs
    rules.ts                    the rules the case agent reads at run time
    types.ts                    domain types
    demoData.ts                 the bundled dataset (storyboard-verbatim)
    useCases.ts                 data access: live overlaid on demo + session state
    caseSlas.ts                 every clock (case, stage, action) in one place
    costSplit.ts                who pays what under each coverage position
    activity.ts                 the activity feed: authored, or derived from stages
    taskFilters.ts              queue facets + their URL encoding
    sla.ts, format.ts           SLA math and display formatting
  lib/flags.ts                  feature flags, localStorage-backed
  services/uipath/
    config.ts                   env → config, with per-feature "is configured" gates
    UiPathProvider.tsx          SDK handle + OAuth
    caseService.ts              Maestro reads/writes; degrades to empty, never throws
    assistantService.ts         Conversational Agent, with a local fallback
  components/warranty/
    CaseTabs.tsx                the 9 case tabs, page + rail variants
    DocumentViewer.tsx          80% dialog: the PDF + what IXP extracted from it
    FeatureFlagsPanel.tsx       presenter switches, in the sidebar footer
    HomepageSplash.tsx          the morning brief above the work queue
    CoverageConsole.tsx         combined-cause console: header, banner, causes, folds
    CoverageDecisionCard.tsx    position, cost split, authority meter, reasoning, settled
    AssessmentPanel.tsx         the agent's assessment as a conversation
    DecisionForm.tsx            the plain decision, shared by console and queue
    …                           stage rail, stage board, SLA panel, activity, evidence
  components/ui/                vendored Vertex shell + primitives
  pages/
    cases/                      queue, detail, decision console
    actions/                    the action queue + its detail pane
    PerformancePage, CasePlansPage
public/documents/               the seven IXP evidence PDFs, served as app assets
```

**`casePlan.ts` is the file to edit when the real case lands.** `caseService.ts` matches
live stage and task names against it by normalised name, so keeping the names identical is
what wires the app to the running case.

Two components are worth knowing before changing anything:

- **`CaseTabs`** renders Overview / Details / Actions / Stages / SLAs / Documents /
  Activity / Trail / Comments. The case detail page uses `variant="page"`; the Actions
  page's right rail uses `variant="rail"`, which drops the three tabs that would
  duplicate the screen around it.
- **`DecisionForm`** is the plain decision: options, recommendation, rationale, submit.
  The Actions detail pane and the plain console both render it, so the decision UI cannot
  drift between them.
- **The console has two shapes.** `DecisionConsolePage` switches on whether the action
  carries `causes`: with them it renders the combined-cause console (`CoverageConsole` +
  `CoverageDecisionCard` + `AssessmentPanel`); without them, the plain layout. Adding
  `causes`, `costLines` and `authority` to an action promotes it, with no code change needed.

## Configuration

Copy `.env.example` to `.env`. Every value is optional and each unlocks one thing:

| Block | Unlocks |
|---|---|
| `VITE_UIPATH_*` | Sign-in. Without it the app never renders a login screen. |
| `VITE_CASE_PROCESS_KEY` | Live case instances, stages, variables, execution history. |
| `VITE_EVIDENCE_ENTITY_ID` | Evidence documents from a Data Fabric entity. |
| `VITE_EVIDENCE_WEBHOOK_URL` | Fires the real scene-15 event instead of simulating it. |
| `VITE_ASSISTANT_AGENT_ID` + `_FOLDER_ID` | Routes Ask AI to a Conversational Agent. |

The work queue's banner states which of these is missing and offers the sign-in when one is
possible, so the app always says why it is showing demo data.

`.npmrc` pins `@uipath` to public npm. `@uipath/uipath-typescript` ships there, and the
pin stops the scope falling through to a gated feed inherited from a parent `.npmrc`.

## Two auth paths, one chosen

This app authenticates through the **UiPath SDK** (`services/uipath/UiPathProvider.tsx`),
which owns the OAuth dance and the API client together. The Vertex shell ships its own PKCE
implementation; it was removed rather than left as a dead second path, and
`components/ui/shell-auth-provider.tsx` is trimmed to the context alone. Nothing provides
that context, so the shell renders straight into the app instead of gating it behind a login
screen. Signing in is an explicit action from the queue, not a wall in front of the demo.

## Hosting

Two build scripts because the **asset base differs by host**:

| Build | Asset base | For |
|---|---|---|
| `npm run build:uipath` | relative `./assets/…` | UiPath Coded Apps |
| `npm run build` | absolute `/assets/…` | root hosting, `vite preview` |

UiPath serves the app under a sub-path and injects `<base href="/<routing-name>/">` plus a
`uipath:app-base` meta tag at deploy time, so that build must emit **relative** paths. At the
domain root there is no injected `<base href>`, so relative paths would resolve against the
current route. A hard refresh on `/cases/WR-2026-0417` would request
`/cases/assets/…` and get `index.html` back as `text/html`, i.e. a blank page.

`src/lib/app-base.ts` reads the meta tag (falling back to `/`) and feeds
`createRouter({ basepath })`, so the same source works on both hosts.
