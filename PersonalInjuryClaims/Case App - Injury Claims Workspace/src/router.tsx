import { useEffect } from "react";
import {
  createRootRoute,
  createRoute,
  createRouter,
  Outlet,
  useNavigate,
  useRouterState,
} from "@tanstack/react-router";
import { BarChart3, FileText, Inbox, Workflow } from "lucide-react";
import { ApolloShell, type ShellNavItem } from "@/components/ui/shell";
import { Spinner } from "@/components/ui/spinner";
import { FeatureFlagsPanel } from "@/components/claims/FeatureFlagsPanel";
import { PersonaSwitcher } from "@/components/claims/PersonaSwitcher";
import { getAppBase } from "@/lib/app-base";
import { useFlags } from "@/lib/flags";
import { useActions, useCases } from "@/lib/claims/useCases";
import { useUiPath } from "@/services/uipath/UiPathProvider";
import { ActionsPage } from "@/pages/actions/ActionsPage";
import { CasesListPage } from "@/pages/cases/CasesListPage";
import { CaseDetailPage } from "@/pages/cases/CaseDetailPage";
import ActionTaskPage from "./pages/cases/ActionTaskPage";
import { PerformancePage } from "@/pages/PerformancePage";
import { CasePlansPage } from "@/pages/CasePlansPage";

// Information architecture follows the console's three tabs (Cases,
// Performance, Case plans) rendered in the Apollo Vertex shell's left nav.
// Labels are i18n keys and must exist in src/locales/en.json.
const NAV_ITEMS: ShellNavItem[] = [
  { path: "/cases", label: "cases", icon: FileText },
  { path: "/actions", label: "actions", icon: Inbox },
  { path: "/performance", label: "performance", icon: BarChart3 },
  { path: "/case-plans", label: "case_plans", icon: Workflow },
];

const rootRoute = createRootRoute({ component: Outlet });

function NavBadge({ count }: { count: number }) {
  return (
    <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-primary/15 px-1.5 text-xs font-semibold tabular-nums text-primary">
      {count}
    </span>
  );
}

function ShellLayout() {
  const { cases } = useCases();
  const actions = useActions();
  const { showCasePlans } = useFlags();
  // Two different counts on purpose: Cases badges how many need a person at all,
  // Actions badges the individual decisions waiting inside them.
  const needsPerson = cases.filter((c) => c.status === "Action required").length;
  const openActions = actions.filter((a) => a.status === "Open").length;

  const counts: Record<string, number> = {
    "/cases": needsPerson,
    "/actions": openActions,
  };

  const navItems = NAV_ITEMS
    // Case plans is design-time material and hidden unless a presenter asks for
    // it. The route stays registered, so a deep link still resolves.
    .filter((item) => item.path !== "/case-plans" || showCasePlans)
    .map((item) =>
      counts[item.path] > 0 ? { ...item, badge: <NavBadge count={counts[item.path]} /> } : item,
    );

  return (
    <ApolloShell
      companyName="Aldergate Personal Injury"
      productName="Claims Resolution"
      navItems={navItems}
      appSwitcher={<PersonaSwitcher />}
      sidebarFooter={<FeatureFlagsPanel />}
    >
      <div className="h-full min-h-0">
        <Outlet />
      </div>
    </ApolloShell>
  );
}

const shellRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: "shell",
  component: ShellLayout,
});

/**
 * The landing route, which is also the OAuth redirect target.
 *
 * It cannot redirect in `beforeLoad`: identity returns to the mount point with
 * `?code=&state=` on the URL, and a redirect there would strip them before the
 * SDK could exchange them, and the sign-in would loop with no error. So it renders
 * instead, and hands off to the queue once the exchange has settled.
 */
function LandingPage() {
  const navigate = useNavigate();
  const { isLoading } = useUiPath();
  const params = new URLSearchParams(useRouterState().location.searchStr);
  const inCallback = params.has("code") && params.has("state");

  useEffect(() => {
    if (inCallback || isLoading) return;
    void navigate({ to: "/cases", replace: true });
  }, [inCallback, isLoading, navigate]);

  return (
    <div className="flex h-full items-center justify-center">
      <span className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        {inCallback || isLoading ? "Signing you in…" : "Opening your queue…"}
      </span>
    </div>
  );
}

const indexRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/",
  component: LandingPage,
});

const casesRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/cases",
  component: CasesListPage,
});

const caseDetailRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/cases/$caseId",
  component: CaseDetailPage,
});

// The decision console URL: /cases/CLAIM-5182/tasks/coverage-decision
const decisionConsoleRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/cases/$caseId/tasks/$taskId",
  component: ActionTaskPage,
});

const actionsRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/actions",
  component: ActionsPage,
  validateSearch: (
    search: Record<string, unknown>,
  ): { task?: string; case?: string; tf?: string } => ({
    task: typeof search.task === "string" ? search.task : undefined,
    case: typeof search.case === "string" ? search.case : undefined,
    tf: typeof search.tf === "string" ? search.tf : undefined,
  }),
});

const performanceRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/performance",
  component: PerformancePage,
});

const casePlansRoute = createRoute({
  getParentRoute: () => shellRoute,
  path: "/case-plans",
  component: CasePlansPage,
});

const routeTree = rootRoute.addChildren([
  shellRoute.addChildren([
    indexRoute,
    casesRoute,
    caseDetailRoute,
    decisionConsoleRoute,
    actionsRoute,
    performanceRoute,
    casePlansRoute,
  ]),
]);

// `basepath` lets one build serve from the domain root (local dev) and from a
// sub-path (UiPath Coded Apps at /<routing-name>). TanStack applies it as a
// location rewrite, stripped on the way in and re-added on the way out, so every
// literal route path and `Link to=` in the app stays unprefixed.
export const router = createRouter({ routeTree, basepath: getAppBase() });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}
