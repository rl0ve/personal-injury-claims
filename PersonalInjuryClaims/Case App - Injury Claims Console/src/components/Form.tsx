/**
 * Action Center host for the shared decision form.
 *
 * The form itself lives in packages/decision-form and knows nothing about who
 * is hosting it. Here it is wired to the CodedActionAppService; the standalone
 * console wires the same component to the Tasks API instead. One UI, two hosts.
 */
import { Theme } from '@uipath/coded-action-app';
import { DecisionForm, type TaskHost, type FormData } from '../../../packages/decision-form';
import { codedActionAppService } from '../uipath';
import { useAuth } from '../hooks/useAuth';
import { writeCaseEvent } from '../caseEvent';

const isDarkTheme = (theme: Theme): boolean =>
  theme === Theme.Dark || theme === Theme.DarkHighContrast;

interface Props {
  onInitTheme: (isDark: boolean) => void;
  darkTheme: boolean;
  onToggleTheme: () => void;
  host?: TaskHost;
}

export default function Form({ host, ...rest }: Props) {
  const { sdk, isAuthenticated } = useAuth();

  /*
    Submitting evidence is an event first and a task completion second. The
    Data Fabric row is what the case's global event listens for
    (`CaseId == metadata.InstanceId` on InjuryClaimCaseEvent), so the Case
    Manager Agent only wakes if the row lands. Until now this host only called
    completeTask, so a submit from Action Center closed the task and woke
    nothing — the fan-out we have been demonstrating only ever fired from the
    workspace app, which does write the row.

    Order matters: write first, and refuse the completion if the write fails.
    A closed task with no event is the one outcome with no way back.
  */
  const actionCenterHost: TaskHost = {
    load: async () => {
      const task = await codedActionAppService.getTask();
      return {
        data: (task.data as Partial<FormData>) ?? null,
        isReadOnly: task.isReadOnly,
        isDark: isDarkTheme(task.theme),
      };
    },
    save: (data) => codedActionAppService.setTaskData(data),
    complete: async (outcome, data) => {
      if (data.actionType === 'SubmitMedicalEvidence') {
        const event = await writeCaseEvent(sdk, isAuthenticated, data.caseInstanceId, {
          eventType: 'DocumentUpload',
          comment: data.decisionRationale,
          documentName: data.uploadedDocumentName,
        });
        if (!event.written) {
          return {
            success: false,
            errorCode: null,
            errorMessage: event.reason ?? 'The case event could not be recorded.',
          };
        }
      }
      return codedActionAppService.completeTask(outcome, data);
    },
  };

  return <DecisionForm host={host ?? actionCenterHost} {...rest} />;
}

export type { TaskHost };
