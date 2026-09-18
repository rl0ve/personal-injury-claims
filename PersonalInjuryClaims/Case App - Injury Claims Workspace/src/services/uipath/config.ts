// Runtime configuration, read once from Vite env.
//
// Every value is optional. With the UiPath block unset the app runs entirely on
// the bundled demo dataset, which is the state a fresh clone starts in, and the
// state to leave it in until the real case is published.

import type { UiPathSDKConfig } from "@uipath/uipath-typescript/core";
import { getAppBase } from "@/lib/app-base";

function env(key: string): string {
  const value = import.meta.env[key as keyof ImportMetaEnv];
  return typeof value === "string" ? value.trim() : "";
}

export const uipathConfig = {
  /**
   * The API host the SDK calls: `https://api.uipath.com`, not the portal.
   *
   * The portal origin serves no `Access-Control-Allow-Origin`, so every request
   * from the browser dies in preflight:
   *   blocked by CORS policy: No 'Access-Control-Allow-Origin' header
   * The `api.` host is the one that answers cross-origin. Identity is reachable
   * through it too, so auth and data share this one value.
   */
  baseUrl: env("VITE_UIPATH_BASE_URL"),
  orgName: env("VITE_UIPATH_ORG_NAME"),
  tenantName: env("VITE_UIPATH_TENANT_NAME"),
  clientId: env("VITE_UIPATH_CLIENT_ID"),
  redirectUri: env("VITE_UIPATH_REDIRECT_URI"),
  scopes: env("VITE_UIPATH_SCOPES"),
  /** Overrides the derived portal origin. Rarely needed; see `portalUrl()`. */
  portalUrl: env("VITE_UIPATH_PORTAL_URL"),
} as const;

/**
 * The origin a PERSON should be sent to, which is not the one the SDK calls.
 *
 * `api.uipath.com` answers API requests; `cloud.uipath.com` serves the UI. Deep
 * links (a case run, an Action Center task, the jobs list) have to use the
 * second or they land on an API host that renders nothing.
 *
 * Production is the awkward one: its API host has no environment label to keep,
 * so `api.` maps to `cloud.` rather than simply being dropped. Everywhere else
 * the label is the environment and only `api.` comes out:
 *   api.uipath.com          → cloud.uipath.com
 *   staging.api.uipath.com  → staging.uipath.com
 *   alpha.api.uipath.com    → alpha.uipath.com
 *
 * Set VITE_UIPATH_PORTAL_URL for a host these two rules do not describe.
 */
export function portalUrl(): string {
  if (uipathConfig.portalUrl) return uipathConfig.portalUrl;
  return uipathConfig.baseUrl
    .replace(/^(https?:\/\/)api\./, "$1cloud.")
    .replace(/^(https?:\/\/[^./]+)\.api\./, "$1.");
}

export const caseConfig = {
  /**
   * processKey of the published Maestro case. Blank ⇒ demo dataset only.
   *
   * Lowercased deliberately. Orchestrator reports the key uppercase, PIMS
   * stores and matches it lowercase, and the instance query is case-sensitive:
   * the uppercase form returns an empty list with a 200, so the app falls back
   * to the demo set and nothing is ever marked live. Costly to spot, one line
   * to prevent.
   */
  processKey: env("VITE_CASE_PROCESS_KEY").toLowerCase(),
  folderKey: env("VITE_CASE_FOLDER_KEY"),
  /**
   * The process the "New case" button starts.
   *
   * Falls back to the case process itself, which is the common setup. Point it
   * at a separate seeding process when one exists. The demo arguments
   * (`demoScenario`, `demoRunId`, `ownerEmail`) suggest a launcher rather than
   * the case's own intake contract, so this is deliberately its own setting.
   */
  newCaseProcessKey: (env("VITE_NEW_CASE_PROCESS_KEY") || env("VITE_CASE_PROCESS_KEY")).toLowerCase(),
  newCaseFolderKey: env("VITE_NEW_CASE_FOLDER_KEY") || env("VITE_CASE_FOLDER_KEY"),
} as const;

export const integrationConfig = {
  evidenceEntityId: env("VITE_EVIDENCE_ENTITY_ID"),
  evidenceWebhookUrl: env("VITE_EVIDENCE_WEBHOOK_URL"),
  assistantAgentId: env("VITE_ASSISTANT_AGENT_ID"),
  assistantFolderId: env("VITE_ASSISTANT_FOLDER_ID"),
} as const;

/**
 * The SDK cannot be constructed without these four. When any is missing the app
 * stays in demo mode and never renders a login screen. A demo that asks for
 * credentials it does not have is worse than one that just runs.
 */
export function isUiPathConfigured(): boolean {
  return Boolean(
    uipathConfig.baseUrl &&
      uipathConfig.orgName &&
      uipathConfig.tenantName &&
      uipathConfig.clientId,
  );
}

/** True once a case is pointed at. This gates every live read. */
export function isCaseConfigured(): boolean {
  return isUiPathConfigured() && Boolean(caseConfig.processKey);
}

export function isAssistantConfigured(): boolean {
  return Boolean(integrationConfig.assistantAgentId && integrationConfig.assistantFolderId);
}

/**
 * Default redirect URI: the app's MOUNT POINT, never the current route.
 *
 * OAuth compares redirect_uri against the registered value character for
 * character, so it has to be the same string from every screen. The obvious
 * `origin + window.location.pathname` is only stable under a hash router (where
 * pathname is always "/"); this app routes on the history API, so from /cases it
 * would send `http://localhost:5173/cases` and identity rejects it with
 * `invalid_request: Invalid redirect_uri`.
 *
 * `getAppBase()` is the mount point, "/" locally and "/<routing-name>" on UiPath
 * Coded Apps, so this yields one value per deployment:
 *   http://localhost:5173/
 *   https://<org>.uipath.host/<routing-name>/
 *
 * The trailing slash matches what a hash-routed app produces, which is the shape
 * these External Apps are normally registered with. If yours is registered
 * without it, set VITE_UIPATH_REDIRECT_URI explicitly. It must match exactly.
 */
function defaultRedirectUri(): string {
  if (typeof window === "undefined") return "";
  const base = getAppBase();
  return base === "/" ? `${window.location.origin}/` : `${window.location.origin}${base}/`;
}

export function buildSdkConfig(): UiPathSDKConfig {
  return {
    baseUrl: uipathConfig.baseUrl,
    orgName: uipathConfig.orgName,
    tenantName: uipathConfig.tenantName,
    clientId: uipathConfig.clientId,
    redirectUri: uipathConfig.redirectUri || defaultRedirectUri(),
    scope: uipathConfig.scopes,
  };
}

/** Deep link to a task in Action Center, on the portal host so a person can open it. */
export function actionCenterUrl(taskId: number | string): string | null {
  if (!uipathConfig.baseUrl || !uipathConfig.orgName || !uipathConfig.tenantName) return null;
  return `${portalUrl()}/${uipathConfig.orgName}/${uipathConfig.tenantName}/actions_/tasks/${taskId}`;
}

/**
 * Deep link to a case instance run in Maestro.
 *
 * The shape is the one the product actually uses: the case processKey is part
 * of the path and the folder rides as a query param, both of which the page
 * needs to resolve the run:
 *   /{org}/{tenant}/maestro_/cases/{processKey}/instances/{instanceId}?folderKey=…
 *
 * Built on the portal origin, not the API host the SDK talks to.
 */
export function maestroInstanceUrl(
  instanceId: string,
  folderKey?: string,
  processKey?: string,
): string | null {
  const key = processKey || caseConfig.processKey;
  if (!instanceId || !key) return null;
  if (!uipathConfig.baseUrl || !uipathConfig.orgName || !uipathConfig.tenantName) return null;

  const folder = folderKey || caseConfig.folderKey;
  const query = folder ? `?folderKey=${encodeURIComponent(folder)}` : "";
  return `${portalUrl()}/${uipathConfig.orgName}/${uipathConfig.tenantName}/maestro_/cases/${key}/instances/${instanceId}${query}`;
}

/** True once the "New case" button has somewhere to send a job. */
export function isNewCaseConfigured(): boolean {
  return isUiPathConfigured() && Boolean(caseConfig.newCaseProcessKey);
}
