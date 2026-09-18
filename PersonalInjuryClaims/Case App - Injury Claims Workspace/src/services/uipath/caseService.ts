// The Maestro read/write layer.
//
// Everything here degrades to null/empty rather than throwing, because the app
// must stay usable on the bundled demo dataset when the tenant is unconfigured,
// the token is stale, or the case has not been published yet. Callers merge what
// comes back over the demo rows (see lib/claims/useCases.ts).

import { CaseInstances } from "@uipath/uipath-typescript/cases";
import type {
  CaseGetStageResponse,
  CaseInstanceExecutionHistoryResponse,
  CaseInstanceGetResponse,
  StageTask,
} from "@uipath/uipath-typescript/cases";
import { Entities } from "@uipath/uipath-typescript/entities";
import type { EntityRecord, FieldMetaData } from "@uipath/uipath-typescript/entities";
import { Tasks, TaskType } from "@uipath/uipath-typescript/tasks";
import type { TaskCompleteOptions, TaskGetResponse } from "@uipath/uipath-typescript/tasks";
import { Processes } from "@uipath/uipath-typescript/processes";
import type { UiPath } from "@uipath/uipath-typescript/core";
import { UiPathError } from "@uipath/uipath-typescript/core";

import {
  findStage,
  normaliseName,
  PRIMARY_STAGES,
  stageForActionType,
} from "@/lib/claims/casePlan";
import { slaStatusFor } from "@/lib/claims/sla";
import type {
  CaseAction,
  CaseStatus,
  EvidenceDocument,
  Priority,
  StageState,
  TaskActor,
  TrailEntry,
  InjuryClaim,
} from "@/lib/claims/types";
import { caseConfig, integrationConfig } from "./config";

// ── Status vocabularies ─────────────────────────────────────────────────────
// Maestro's status strings vary by element type and version, so match on a
// normalised form against a set rather than on exact equality.

function normaliseStatus(status: string | undefined | null): string {
  return (status ?? "").toLowerCase().replace(/[^a-z]/g, "");
}

const COMPLETED_STATUSES = new Set([
  "completed",
  "complete",
  "done",
  "success",
  "successful",
  "succeeded",
  "finished",
  "closed",
]);

const IN_PROGRESS_STATUSES = new Set([
  "running",
  "inprogress",
  "active",
  "started",
  "starting",
  "paused",
  "waiting",
  "pending",
  "inreview",
  "unassigned",
  "assigned",
]);

const SKIPPED_STATUSES = new Set(["skipped", "bypassed", "notrequired"]);

// ── Stages ──────────────────────────────────────────────────────────────────

function flattenTasks(stage: CaseGetStageResponse): StageTask[] {
  return (stage.tasks ?? []).flat().filter(Boolean);
}

/**
 * A stage's own status wins when it is conclusive. When it is not, because Maestro
 * leaves ad-hoc stages unset until something in them runs, fall back to the
 * tasks: all completed ⇒ completed, any started ⇒ active, otherwise pending.
 */
export function classifyStage(stage: CaseGetStageResponse): StageState {
  const status = normaliseStatus(stage.status);
  if (COMPLETED_STATUSES.has(status)) return "completed";
  if (SKIPPED_STATUSES.has(status)) return "skipped";

  const tasks = flattenTasks(stage);

  /*
    Maestro never moves a CaseStage off InProgress. A case sitting in Settlement
    & Closure still reports Fnol01, Trge02 and Invs03 as InProgress, so trusting
    the stage status alone meant no stage was ever "completed" and every summary
    read "0 of 8 stages are complete".

    So an in-progress stage whose tasks have all finished counts as complete.
    The stage the case is actually in keeps at least one task open, which is what
    keeps it "active" rather than sweeping it up with the rest.
  */
  if (IN_PROGRESS_STATUSES.has(status)) {
    const live = tasks.map((t) => normaliseStatus(t.status));
    if (live.length > 0 && live.every((s) => COMPLETED_STATUSES.has(s))) return "completed";
    return "active";
  }

  if (tasks.length === 0) return "pending";

  const statuses = tasks.map((t) => normaliseStatus(t.status));
  if (statuses.every((s) => COMPLETED_STATUSES.has(s))) return "completed";
  if (statuses.some((s) => IN_PROGRESS_STATUSES.has(s) || COMPLETED_STATUSES.has(s)))
    return "active";
  return "pending";
}

/** Maps live stages onto case-plan stage ids. Unknown stage names are dropped. */
export function mapStageStates(stages: CaseGetStageResponse[]): Record<string, StageState> {
  const states: Record<string, StageState> = {};
  for (const stage of stages) {
    const definition = findStage(stage.name);
    if (!definition) continue;
    states[definition.id] = classifyStage(stage);
  }
  return states;
}

/**
 * The stage the case is *in*. Ad-hoc stages that were defined but never
 * triggered stay "not started", so several earlier stages can look active at
 * once, and the furthest-progressed one is the answer.
 */
export function deriveCurrentStage(stages: CaseGetStageResponse[] | null | undefined): string | null {
  if (!stages?.length) return null;

  const ordered = PRIMARY_STAGES.map((definition) => {
    const live = stages.find((s) => normaliseName(s.name) === normaliseName(definition.name));
    return { name: definition.name, state: live ? classifyStage(live) : ("pending" as StageState) };
  });

  let lastActive = -1;
  let lastCompleted = -1;
  ordered.forEach((s, i) => {
    if (s.state === "active") lastActive = i;
    if (s.state === "completed") lastCompleted = i;
  });

  if (lastActive >= 0) return ordered[lastActive].name;
  if (lastCompleted >= 0) {
    return ordered[Math.min(lastCompleted + 1, ordered.length - 1)].name;
  }
  return ordered[0].name;
}

/** Conditional/terminal lanes that are currently open alongside the primary stage. */
export function deriveActiveLanes(stages: CaseGetStageResponse[]): string[] {
  return stages
    .filter((s) => {
      const definition = findStage(s.name);
      return definition && definition.kind !== "primary" && classifyStage(s) === "active";
    })
    .map((s) => findStage(s.name)!.name);
}

// ── Instances ───────────────────────────────────────────────────────────────

function statusFromRun(runStatus: string): CaseStatus {
  const s = normaliseStatus(runStatus);
  if (COMPLETED_STATUSES.has(s)) return "Closed";
  if (s === "faulted" || s === "cancelled" || s === "canceled") return "Action required";
  return "Progressing";
}

function minutesBetween(fromIso: string, toIso?: string | null): number {
  const from = Date.parse(fromIso);
  if (Number.isNaN(from)) return 0;
  const to = toIso ? Date.parse(toIso) : Date.now();
  return Math.max(0, Math.round(((Number.isNaN(to) ? Date.now() : to) - from) / 60_000));
}

/**
 * Shapes one live instance into the app's case model. Fields Maestro does not
 * carry (claimant, incident location, injury, claim value) come from case variables when the
 * published case declares them, and are left blank otherwise rather than
 * invented. `useCases` fills those gaps from the demo row of the same id.
 */
export function mapInstance(
  instance: CaseInstanceGetResponse,
  stages: CaseGetStageResponse[] | null,
  variables: Record<string, string | number>,
): InjuryClaim {
  const stageStates = stages ? mapStageStates(stages) : {};
  const currentStage = deriveCurrentStage(stages) ?? PRIMARY_STAGES[0].name;
  const definition = findStage(currentStage);
  const slaMinutes = definition?.slaMinutes ?? 24 * 60;
  const elapsedMinutes = minutesBetween(instance.startedTime, instance.completedTime);

  const str = (key: string): string => {
    const value = variables[key];
    return typeof value === "string" ? value : "";
  };
  const num = (key: string): number => {
    const value = variables[key];
    return typeof value === "number" ? value : Number(value) || 0;
  };

  return {
    id: str("caseIdentifier") || instance.instanceDisplayName || instance.instanceId.slice(0, 8),
    instanceId: instance.instanceId,
    folderKey: instance.folderKey,
    customer: str("customer") || str("customerName"),
    site: str("site") || str("siteId"),
    asset: {
      model: str("assetModel"),
      serial: str("assetSerial"),
      description: str("failureDescription"),
      inServiceMonths: num("inServiceMonths"),
      coverageStatus: str("entitlement") || "Unknown",
    },
    priority: ((): Priority => {
      const p = str("priority").toUpperCase();
      return p === "P1" || p === "P2" || p === "P3" || p === "P4" ? p : "P3";
    })(),
    status: statusFromRun(instance.latestRunStatus),
    currentStage,
    activeLanes: stages ? deriveActiveLanes(stages) : [],
    owner: instance.startedByUser || "",
    ownerRole: "",
    description: str("failureDescription") || instance.caseTitle || "",
    claimValue: num("estimatedClaimCost"),
    openedAt: instance.startedTime,
    lastUpdatedAt: instance.completedTime || instance.startedTime,
    slaMinutes,
    elapsedMinutes,
    slaStatus: slaStatusFor(elapsedMinutes, slaMinutes),
    stageStates,
    evidence: [],
    trail: [],
    variables,
    // Left empty: the activity feed is derived from stage states, and a live
    // instance's real history arrives separately via getExecutionHistory.
    activity: [],
    comments: [],
    caseManagerMode: "hybrid",
    closureReason: str("closureReason") || undefined,
    isLive: true,
  };
}

export interface LiveCaseResult {
  cases: InjuryClaim[];
  /** True when the read failed or the case is unconfigured, which the UI says. */
  degraded: boolean;
  reason?: string;
}

/**
 * Lists case instances for the configured process. Stage detail is fetched per
 * instance, so this is deliberately capped: the list view needs the current
 * stage of every row, and 50 instances is well past what a demo shows.
 */
export async function fetchCases(sdk: UiPath, limit = 50): Promise<LiveCaseResult> {
  if (!caseConfig.processKey) {
    return { cases: [], degraded: true, reason: "No case process key configured" };
  }
  try {
    const caseInstances = new CaseInstances(sdk);
    const result = await caseInstances.getAll({
      processKey: caseConfig.processKey,
      pageSize: limit,
    });

    const cases = await Promise.all(
      result.items.map(async (instance) => {
        const folderKey = instance.folderKey || caseConfig.folderKey;
        const [stages, variables] = await Promise.all([
          fetchStages(sdk, instance.instanceId, folderKey),
          fetchVariables(sdk, instance.instanceId, folderKey),
        ]);
        return mapInstance(instance, stages, variables);
      }),
    );
    return { cases, degraded: false };
  } catch (err) {
    const reason = err instanceof UiPathError ? err.message : String(err);
    console.warn("fetchCases failed, falling back to demo data:", reason);
    return { cases: [], degraded: true, reason };
  }
}

export async function fetchCaseById(
  sdk: UiPath,
  instanceId: string,
  folderKey: string,
): Promise<InjuryClaim | null> {
  try {
    const caseInstances = new CaseInstances(sdk);
    const instance = await caseInstances.getById(instanceId, folderKey);
    const [stages, variables, history] = await Promise.all([
      fetchStages(sdk, instanceId, folderKey),
      fetchVariables(sdk, instanceId, folderKey),
      fetchExecutionHistory(sdk, instanceId, folderKey),
    ]);
    const mapped = mapInstance(instance, stages, variables);
    return { ...mapped, trail: history ? mapExecutionHistory(history) : [] };
  } catch (err) {
    console.warn("fetchCaseById failed:", err);
    return null;
  }
}

export async function fetchStages(
  sdk: UiPath,
  instanceId: string,
  folderKey: string,
): Promise<CaseGetStageResponse[] | null> {
  if (!instanceId || !folderKey) return null;
  try {
    return await new CaseInstances(sdk).getStages(instanceId, folderKey);
  } catch (err) {
    console.warn("fetchStages failed:", err);
    return null;
  }
}

export async function fetchVariables(
  sdk: UiPath,
  instanceId: string,
  folderKey: string,
): Promise<Record<string, string | number>> {
  if (!instanceId || !folderKey) return {};
  try {
    const response = await new CaseInstances(sdk).getVariables(instanceId, folderKey);
    const variables: Record<string, string | number> = {};
    for (const v of response.globalVariables ?? []) {
      if (typeof v.value === "string" || typeof v.value === "number") {
        variables[v.name] = v.value;
      } else if (v.value != null) {
        variables[v.name] = JSON.stringify(v.value);
      }
    }
    return variables;
  } catch (err) {
    console.warn("fetchVariables failed:", err);
    return {};
  }
}

export async function fetchExecutionHistory(
  sdk: UiPath,
  instanceId: string,
  folderKey: string,
): Promise<CaseInstanceExecutionHistoryResponse | null> {
  if (!instanceId || !folderKey) return null;
  try {
    return await new CaseInstances(sdk).getExecutionHistory(instanceId, folderKey);
  } catch (err) {
    console.warn("fetchExecutionHistory failed:", err);
    return null;
  }
}

/**
 * Element executions → the execution trail. `externalLink` being present is how
 * Maestro marks an element that produced an Action Center task, which is the
 * best available signal that a human acted rather than an agent or a process.
 */
export function mapExecutionHistory(history: CaseInstanceExecutionHistoryResponse): TrailEntry[] {
  const elements = [...(history.elementExecutions ?? [])].sort(
    (a, b) => Date.parse(a.startedTime) - Date.parse(b.startedTime),
  );

  return elements.map((element, index) => {
    const actor: TaskActor = element.externalLink ? "human" : "process";
    return {
      seq: index + 1,
      actor,
      actorLabel: actor === "human" ? "HT" : "PR",
      step: element.elementName || element.elementId,
      stage: findStage(element.elementName ?? "")?.name ?? "",
      time: element.completedTime
        ? new Date(element.completedTime).toLocaleTimeString("en-US", {
            hour: "2-digit",
            minute: "2-digit",
          })
        : "",
    };
  });
}

// ── Human tasks ─────────────────────────────────────────────────────────────

/**
 * Maestro stamps the case instance id onto each Action Center task, but in
 * different places depending on the task source and version: CreatorJobKey on
 * the raw object, an "externalid" tag, taskSource.sourceId, or buried in the
 * input data. Check them all rather than betting on one.
 */
function taskMatchesInstance(task: TaskGetResponse, instanceId: string): boolean {
  const id = instanceId.toLowerCase();

  const direct = [task.taskSource?.sourceId, task.parentOperationId, task.externalTag];
  if (direct.some((v) => typeof v === "string" && v.toLowerCase() === id)) return true;

  const creatorJobKey = readCreatorJobKey(task);
  if (creatorJobKey?.toLowerCase() === id) return true;
  if (readExternalIdTag(task)?.toLowerCase() === id) return true;

  const metadata = task.taskSource?.taskSourceMetadata;
  if (metadata && JSON.stringify(metadata).toLowerCase().includes(id)) return true;
  if (task.data && JSON.stringify(task.data).toLowerCase().includes(id)) return true;

  return false;
}

/** CreatorJobKey isn't on the typed response, so peek at the raw object. */
function readCreatorJobKey(task: TaskGetResponse): string | null {
  const peek = (obj: unknown): string | null => {
    if (!obj || typeof obj !== "object") return null;
    const record = obj as Record<string, unknown>;
    const value = record.CreatorJobKey ?? record.creatorJobKey;
    return typeof value === "string" ? value : null;
  };
  return peek(task) ?? peek(task.taskSource?.taskSourceMetadata) ?? peek(task.data) ?? null;
}

function readExternalIdTag(task: TaskGetResponse): string | null {
  const tags = (task as unknown as { tags?: unknown }).tags;
  if (!Array.isArray(tags)) return null;
  for (const raw of tags) {
    if (!raw || typeof raw !== "object") continue;
    const tag = raw as Record<string, unknown>;
    const name = typeof tag.name === "string" ? tag.name : typeof tag.Name === "string" ? tag.Name : null;
    const value =
      typeof tag.value === "string" ? tag.value : typeof tag.Value === "string" ? tag.Value : null;
    if (name?.toLowerCase() === "externalid" && value) return value;
  }
  return null;
}

/** Open Action Center tasks belonging to one case instance. */
export async function fetchTasksForCase(
  sdk: UiPath,
  instanceId: string,
): Promise<TaskGetResponse[]> {
  if (!instanceId) return [];
  try {
    const result = await new Tasks(sdk).getAll({ pageSize: 200 });
    return result.items.filter((t) => taskMatchesInstance(t, instanceId));
  } catch (err) {
    console.warn("fetchTasksForCase failed:", err);
    return [];
  }
}

/**
 * The one open task for a case, optionally narrowed to a specific Action App
 * dispatch code. The SDD's design puts every human decision behind one
 * code-switched Action App, so `actionType` is what separates a coverage
 * decision from a closure disposition on the same case.
 */
export async function findOpenTask(
  sdk: UiPath,
  instanceId: string,
  actionType?: string,
): Promise<TaskGetResponse | null> {
  const tasks = await fetchTasksForCase(sdk, instanceId);
  const open = tasks.filter((t) => normaliseStatus(t.status) !== "completed");
  if (!actionType) return open[0] ?? null;

  const wanted = normaliseName(actionType);
  return (
    open.find((t) => {
      const data = t.data as Record<string, unknown> | undefined;
      const dataType = data && typeof data.actionType === "string" ? data.actionType : "";
      if (dataType && normaliseName(dataType) === wanted) return true;
      return normaliseName(String(t.title ?? "")).includes(wanted);
    }) ?? null
  );
}

/**
 * Completes a human task with the chosen outcome. `action` is the Action App
 * button value (the SDD's taskOutcome), `data` carries the recorded fields,
 * rationale, evidence-usefulness signals, anything the app schema exposes.
 */
/**
 * Completes one specific task, by its Orchestrator id.
 *
 * The lookup-by-instance path below has to guess which of a case's open tasks
 * the screen means, and it guesses from an `actionType` that Action Center does
 * not always carry. When the route already names the task — and from a case's
 * task list it always does — there is nothing to search for.
 */
export async function completeTaskById(
  sdk: UiPath,
  taskId: number,
  outcome: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  const tasks = new Tasks(sdk);
  const task = await tasks.getById(taskId);
  if (!task) throw new Error(`Task ${taskId} could not be read`);

  const options: TaskCompleteOptions =
    task.type === TaskType.App || task.type === TaskType.Form
      ? { type: task.type, action: outcome, data }
      : { type: task.type, action: outcome };

  await task.complete(options);
}

export async function completeTask(
  sdk: UiPath,
  instanceId: string,
  actionType: string,
  outcome: string,
  data: Record<string, unknown> = {},
): Promise<void> {
  const task = await findOpenTask(sdk, instanceId, actionType);
  if (!task) throw new Error(`No open "${actionType}" task found for this case`);

  const options: TaskCompleteOptions =
    task.type === TaskType.App || task.type === TaskType.Form
      ? { type: task.type, action: outcome, data }
      : { type: task.type, action: outcome };

  await task.complete(options);
}

// ── Live actions ────────────────────────────────────────────────────────────

/** Action Center priorities map onto the case's P1–P4 bands. */
const TASK_PRIORITY: Record<string, Priority> = {
  Critical: "P1",
  High: "P2",
  Medium: "P3",
  Low: "P4",
};

/**
 * The Action App dispatch code a task carries.
 *
 * SDD §4 puts every human decision behind one code-switched Action App, so the
 * `actionType` in the task's data is what separates a coverage decision from a
 * closure disposition. Falls back to matching the title against the case plan,
 * because a task raised before that field was wired still has to land somewhere.
 */
function readActionType(task: TaskGetResponse): string {
  const data = task.data as Record<string, unknown> | undefined;
  const declared = data && typeof data.actionType === "string" ? data.actionType : "";
  if (declared) return declared;

  const title = normaliseName(String(task.title ?? ""));
  for (const stage of PRIMARY_STAGES) {
    for (const t of stage.tasks) {
      if (t.actionType && title.includes(normaliseName(t.name))) return t.actionType;
    }
  }
  return "";
}

function minutesUntil(iso: string | null | undefined): number | null {
  if (!iso) return null;
  const at = Date.parse(iso);
  return Number.isNaN(at) ? null : Math.round((at - Date.now()) / 60_000);
}

/**
 * Shapes one live Action Center task into the app's action model.
 *
 * Only what Action Center actually carries is filled in: title, assignee,
 * status, priority, the clock. The console's argument (the two causes, the cost
 * lines, the authority limit) is not in a task payload, so it is left off here
 * and merged from the matching demo action by `useCases`, the same way case
 * presentation fields are. That keeps this function honest: it never invents a
 * finding that Maestro did not send.
 */
export function mapTask(task: TaskGetResponse, caseId: string): CaseAction {
  const actionType = readActionType(task);
  const stage = stageForActionType(actionType);
  const sla = task.taskSlaDetail ?? task.taskSlaDetails?.[0] ?? null;
  const dueAt = (sla as { dueDate?: string } | null)?.dueDate ?? null;

  const remaining = minutesUntil(dueAt);
  const elapsedSinceCreated = Math.max(
    0,
    Math.round((Date.now() - Date.parse(task.createdTime)) / 60_000),
  );
  // Prefer the real deadline; without one, the stage's own budget is the best
  // available frame for how far through the clock this task is.
  const slaMinutes =
    remaining != null && remaining + elapsedSinceCreated > 0
      ? remaining + elapsedSinceCreated
      : (stage?.slaMinutes ?? 4 * 60);

  return {
    id: String(task.id),
    caseId,
    actionType,
    title: task.title,
    stage: stage?.name ?? "",
    assignee: task.assignedToUser?.name ?? task.taskAssigneeName ?? "Unassigned",
    priority: TASK_PRIORITY[String(task.priority)] ?? "P3",
    blocking: true,
    dueAt: dueAt ?? new Date(Date.now() + slaMinutes * 60_000).toISOString(),
    slaMinutes,
    elapsedMinutes: Math.min(elapsedSinceCreated, slaMinutes),
    whyThisReachedYou: "",
    options: (stage?.tasks.find((t) => t.actionType === actionType)?.outcomes ?? []).map(
      (outcome) => ({ outcome, label: outcome, rationale: "", supported: true }),
    ),
    recommendation: {
      headline: "",
      detail: "",
      confidence: "medium",
      recommendedOutcome: "",
      evidenceBasis: [],
    },
    status: normaliseStatus(task.status) === "completed" ? "Completed" : "Open",
    completedBy: task.completedByUser?.name,
    completedAt: task.completedTime ?? undefined,
    completedOutcome: task.action ?? undefined,
  };
}

export interface LiveActionsResult {
  actions: CaseAction[];
  degraded: boolean;
  reason?: string;
}

/**
 * Every open Action Center task belonging to the given case instances.
 *
 * One `getAll` for the whole set rather than one per case: the queue shows every
 * case at once, and a request per row would be dozens of round trips for a list
 * that is already on screen.
 */
export async function fetchActions(
  sdk: UiPath,
  cases: { instanceId: string; id: string }[],
): Promise<LiveActionsResult> {
  if (cases.length === 0) return { actions: [], degraded: false };

  try {
    const result = await new Tasks(sdk).getAll({ pageSize: 200 });
    const byInstance = cases.filter((c) => c.instanceId);

    const actions: CaseAction[] = [];
    for (const task of result.items) {
      const owner = byInstance.find((c) => taskMatchesInstance(task, c.instanceId));
      if (!owner) continue;
      actions.push(mapTask(task, owner.id));
    }
    return { actions, degraded: false };
  } catch (err) {
    const reason = err instanceof UiPathError ? err.message : String(err);
    console.warn("fetchActions failed:", reason);
    return { actions: [], degraded: true, reason };
  }
}

// ── Starting a case ─────────────────────────────────────────────────────────

export interface NewCaseInput {
  /** Standard | MissingEvidence | Rejected | Critical */
  demoScenario: string;
  demoRunId: string;
  ownerEmail: string;
}

/**
 * Starts the configured process with the demo arguments.
 *
 * Orchestrator takes `inputArguments` as a JSON *string*, not an object. A
 * plain object silently starts the job with no arguments at all, which looks
 * like success and produces a case with nothing in it.
 */
export async function startNewCase(
  sdk: UiPath,
  input: NewCaseInput,
): Promise<{ jobId?: number; jobKey?: string }> {
  const processKey = caseConfig.newCaseProcessKey;
  if (!processKey) {
    throw new Error("No process configured. Set VITE_NEW_CASE_PROCESS_KEY or VITE_CASE_PROCESS_KEY");
  }
  if (!caseConfig.newCaseFolderKey) {
    throw new Error("No folder configured. Set VITE_NEW_CASE_FOLDER_KEY or VITE_CASE_FOLDER_KEY");
  }

  const jobs = await new Processes(sdk).start(
    { processKey, inputArguments: JSON.stringify(input) },
    { folderKey: caseConfig.newCaseFolderKey },
  );

  const first = jobs?.[0] as { id?: number; key?: string } | undefined;
  return { jobId: first?.id, jobKey: first?.key };
}

// ── Evidence documents (Data Fabric) ────────────────────────────────────────

/**
 * Picks the attachment field. Exact-name matches come before the regex so a
 * label like "DocumentName" can't win over the real "File" attachment field.
 */
function pickAttachmentField(fields: FieldMetaData[]): string | null {
  const flagged = fields.find((f) => f.isAttachment);
  if (flagged) return flagged.name;
  for (const name of ["File", "Attachment", "Document"]) {
    const match = fields.find((f) => f.name.toLowerCase() === name.toLowerCase());
    if (match) return match.name;
  }
  return fields.find((f) => /document|file|attach/i.test(f.name))?.name ?? null;
}

function pickDisplayField(fields: FieldMetaData[]): string | null {
  for (const name of ["Title", "Name", "DocumentName", "FileName", "DisplayName"]) {
    const match = fields.find((f) => f.name.toLowerCase() === name.toLowerCase());
    if (match) return match.name;
  }
  return fields.find((f) => !f.isAttachment && !f.isPrimaryKey && !f.isSystemField)?.name ?? null;
}

function recordValue(record: EntityRecord, field: string | null): string | null {
  if (!field) return null;
  const value = record[field];
  if (value == null) return null;
  if (typeof value === "string") return value;
  if (typeof value === "object" && "name" in value && typeof (value as { name: unknown }).name === "string") {
    return (value as { name: string }).name;
  }
  return String(value);
}

export interface EvidenceResult {
  documents: EvidenceDocument[];
  attachmentField: string | null;
}

export async function fetchEvidence(sdk: UiPath, caseId: string): Promise<EvidenceResult> {
  if (!integrationConfig.evidenceEntityId) return { documents: [], attachmentField: null };
  try {
    const entities = new Entities(sdk);
    const [entity, records] = await Promise.all([
      entities.getById(integrationConfig.evidenceEntityId),
      entities.getAllRecords(integrationConfig.evidenceEntityId, { pageSize: 100 }),
    ]);
    const attachmentField = pickAttachmentField(entity.fields);
    const displayField = pickDisplayField(entity.fields);

    const documents = records.items
      // Rows are entity-wide; keep only the ones stamped with this case.
      .filter((r) => !caseId || JSON.stringify(r).includes(caseId))
      .map<EvidenceDocument>((r) => ({
        id: r.Id,
        kind: "pdf",
        title: recordValue(r, displayField) ?? `Document ${r.Id.slice(0, 8)}`,
        addedAt: typeof r.CreateTime === "string" ? r.CreateTime : new Date().toISOString(),
        addedBy: recordValue(r, "CreatedBy") ?? "Unknown",
        helpful: null,
      }));

    return { documents, attachmentField };
  } catch (err) {
    console.warn("fetchEvidence failed:", err);
    return { documents: [], attachmentField: null };
  }
}

export async function downloadEvidence(
  sdk: UiPath,
  recordId: string,
  fieldName: string,
): Promise<Blob> {
  return new Entities(sdk).downloadAttachment(integrationConfig.evidenceEntityId, recordId, fieldName);
}

// ── Events ──────────────────────────────────────────────────────────────────

/**
 * Writes the row that wakes the Case Manager Agent.
 *
 * The agent's global event listens for a CREATED row on InjuryClaimCaseEvent
 * filtered on CaseId, so the row must carry the running instance id. `caseId`
 * comes from the case the console already loaded — never from the form — so a
 * submission cannot be pointed at someone else's case.
 */
export async function writeCaseEvent(
  sdk: UiPath,
  caseId: string,
  fields: { comment?: string; documentName?: string; eventType?: string },
): Promise<{ written: boolean; reason?: string }> {
  if (!integrationConfig.evidenceEntityId) {
    return { written: false, reason: "VITE_EVIDENCE_ENTITY_ID is not configured" };
  }
  if (!caseId) {
    return { written: false, reason: "No case instance id in context" };
  }
  try {
    await new Entities(sdk).insertRecordById(integrationConfig.evidenceEntityId, {
      CaseId: caseId,
      EventType: fields.eventType ?? "DocumentUpload",
      Comment: fields.comment ?? "",
      DocumentName: fields.documentName ?? "",
    });
    return { written: true };
  } catch (err) {
    return {
      written: false,
      reason: err instanceof UiPathError ? err.message : String(err),
    };
  }
}


/**
 * Fires the configured webhook, the storyboard's scene-15 trigger, where a
 * claimant upload becomes an event that wakes the case agent. Without a
 * configured URL the caller falls back to simulating the event locally.
 */
export async function triggerEvidenceWebhook(accessToken?: string): Promise<void> {
  if (!integrationConfig.evidenceWebhookUrl) {
    throw new Error("VITE_EVIDENCE_WEBHOOK_URL is not configured");
  }
  const headers: Record<string, string> = { Accept: "application/json" };
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;

  const response = await fetch(integrationConfig.evidenceWebhookUrl, { method: "GET", headers });
  if (!response.ok) {
    throw new Error(`Webhook returned ${response.status} ${response.statusText}`);
  }
}
