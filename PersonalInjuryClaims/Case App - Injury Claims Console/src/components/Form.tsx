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

const isDarkTheme = (theme: Theme): boolean =>
  theme === Theme.Dark || theme === Theme.DarkHighContrast;

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
  complete: (outcome, data) => codedActionAppService.completeTask(outcome, data),
};

interface Props {
  onInitTheme: (isDark: boolean) => void;
  darkTheme: boolean;
  onToggleTheme: () => void;
  host?: TaskHost;
}

export default function Form({ host = actionCenterHost, ...rest }: Props) {
  return <DecisionForm host={host} {...rest} />;
}

export type { TaskHost };
