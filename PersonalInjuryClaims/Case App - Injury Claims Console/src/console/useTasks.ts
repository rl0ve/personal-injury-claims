import { useCallback, useEffect, useMemo, useState } from 'react';
import { Tasks, TaskType } from '@uipath/uipath-typescript/tasks';
import type { UiPath } from '@uipath/uipath-typescript/core';

/**
 * Live Action Center tasks for the web-app surface.
 *
 * The web app is the driver: it lists the claim's pending action tasks, opens
 * one inline, and completes it. `injury-claims-console` action tasks carry
 * an `actionType` in their task data, which selects which form to render.
 */

export interface LiveTask {
  id: number;
  key: string;
  title: string;
  folderId: number;
  type: TaskType;
  action: string | null;
  createdTime: string;
  /** Task data payload — the action app's inputs (actionType, claimReference, …). */
  data: Record<string, unknown> | null;
}

const PENDING_FILTER = "Status ne 'Completed'";

export function useTasks(sdk: UiPath | null, enabled: boolean) {
  const [tasks, setTasks] = useState<LiveTask[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const service = useMemo(() => (sdk ? new Tasks(sdk) : null), [sdk]);

  const load = useCallback(async () => {
    if (!service || !enabled) return;
    setLoading(true);
    setError(null);
    try {
      const result = await service.getAll({ filter: PENDING_FILTER, pageSize: 50 });
      const bag = result as unknown as { items?: unknown[] } | unknown[];
      const items: unknown[] = Array.isArray(bag) ? bag : (bag.items ?? []);
      const mapped: LiveTask[] = (items as Record<string, unknown>[]).map((t) => ({
        id: Number(t.id),
        key: String(t.key ?? ''),
        title: String(t.title ?? 'Untitled task'),
        folderId: Number(t.folderId),
        type: t.type as TaskType,
        action: (t.action as string | null) ?? null,
        createdTime: String(t.createdTime ?? ''),
        data: null,
      }));
      setTasks(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load tasks');
    } finally {
      setLoading(false);
    }
  }, [service, enabled]);

  useEffect(() => { void load(); }, [load]);

  /** Fetch the task's data payload (the action app inputs) on demand. */
  const loadTaskData = useCallback(
    async (task: LiveTask): Promise<Record<string, unknown>> => {
      if (!service) return {};
      const res = await service.getDataById(task.id, { folderId: task.folderId });
      const raw = res as unknown as Record<string, unknown>;
      return (raw.data as Record<string, unknown>) ?? raw ?? {};
    },
    [service],
  );

  /** Complete a task with an outcome and the collected form data. */
  const completeTask = useCallback(
    async (task: LiveTask, outcome: string, data: Record<string, unknown>) => {
      if (!service) throw new Error('Not connected');
      // TaskCompleteOptions is a discriminated union on `type` — branch explicitly.
      if (task.type === TaskType.App) {
        await service.complete(
          { taskId: task.id, type: TaskType.App, action: outcome, data },
          task.folderId,
        );
      } else if (task.type === TaskType.Form) {
        await service.complete(
          { taskId: task.id, type: TaskType.Form, action: outcome, data },
          task.folderId,
        );
      } else {
        await service.complete(
          { taskId: task.id, type: TaskType.External, action: outcome, data },
          task.folderId,
        );
      }
      await load();
    },
    [service, load],
  );

  return { tasks, loading, error, reload: load, loadTaskData, completeTask };
}
