import { NoticeSnackbar, snackbar, useNotice } from '@kitbag/core-design';
import {
  findTool,
  INSTALL_START,
  NO_TOOL_DATA,
  useToolCatalogue,
  useToolInstall,
  useTools,
} from '@kitbag/core-state';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { BUILT_TOOL_IDS } from '../home/registry.ts';
import { DeleteToolDataDialog, RemoveToolDialog } from './RemoveToolDialog.tsx';
import { SettingsFrame } from './SettingsFrame.tsx';
import { ToolInstallBar } from './ToolInstallBar.tsx';
import { toolPageModel } from './toolPageModel.ts';
import { PageBody } from './ToolPageSections.tsx';
import {
  COULD_NOT_DELETE_DATA,
  couldNotInstall,
  couldNotRemove,
} from './toolPageText.ts';
import { TOOLS_TITLE, toolName, toolSwitchStep } from './toolsText.ts';

export interface ToolPageScreenProps {
  readonly toolId: string;
  readonly onBack: () => void;
  readonly onOptIn: (toolId: string) => void;
  readonly onRemoved: (toolId: string) => void;
  readonly onOpen?: (() => void) | undefined;
}

type Asking = 'none' | 'remove' | 'deleteData';

interface ActionContext {
  readonly toolId: string;
  readonly name: string;
  readonly onOptIn: (toolId: string) => void;
  readonly onRemoved: (toolId: string) => void;
  readonly showMessage: (message: string) => void;
}

function useToolActions({
  toolId,
  name,
  onOptIn,
  onRemoved,
  showMessage,
}: ActionContext) {
  const install = useToolInstall((s) => s.install);
  const cancel = useToolInstall((s) => s.cancel);
  const dismiss = useToolInstall((s) => s.dismiss);
  const remove = useToolInstall((s) => s.remove);
  const deleteData = useToolInstall((s) => s.deleteData);
  const [asking, setAsking] = useState<Asking>('none');
  return {
    asking,
    install: useCallback(() => {
      install(toolId).then(
        (start) => {
          if (start === INSTALL_START.optIn) onOptIn(toolId);
        },
        () => {
          showMessage(couldNotInstall(name));
        },
      );
    }, [install, toolId, onOptIn, showMessage, name]),
    optIn: useCallback(() => {
      onOptIn(toolId);
    }, [onOptIn, toolId]),
    cancel: useCallback(() => {
      cancel(toolId);
    }, [cancel, toolId]),
    dismiss: useCallback(() => {
      dismiss(toolId);
    }, [dismiss, toolId]),
    askRemove: useCallback(() => {
      setAsking('remove');
    }, []),
    askDeleteData: useCallback(() => {
      setAsking('deleteData');
    }, []),
    stopAsking: useCallback(() => {
      setAsking('none');
    }, []),
    confirmRemove: useCallback(
      (alsoData: boolean) => {
        setAsking('none');
        remove(toolId, { deleteData: alsoData }).then(
          () => {
            onRemoved(toolId);
          },
          () => {
            showMessage(couldNotRemove(name));
          },
        );
      },
      [remove, toolId, onRemoved, showMessage, name],
    ),
    confirmDeleteData: useCallback(() => {
      setAsking('none');
      deleteData(toolId).catch(() => {
        showMessage(COULD_NOT_DELETE_DATA);
      });
    }, [deleteData, toolId, showMessage]),
  };
}

export function ToolPageScreen({
  toolId,
  onBack,
  onOptIn,
  onRemoved,
  onOpen,
}: ToolPageScreenProps) {
  const insets = useSafeAreaInsets();
  const catalogue = useToolInstall((s) => s.catalogue);
  const downloads = useToolInstall((s) => s.downloads);
  const job = useToolInstall((s) => s.jobs[toolId]);
  const data = useToolInstall((s) => s.data[toolId]) ?? NO_TOOL_DATA;
  const refresh = useToolInstall((s) => s.refresh);
  const off = useTools((s) => s.off);
  const setOff = useTools((s) => s.setOff);
  const { on } = useToolCatalogue(BUILT_TOOL_IDS);
  const notice = useNotice();
  const tool = findTool(catalogue, toolId);
  const name = tool === undefined ? toolId : toolName(tool);
  const actions = useToolActions({
    toolId,
    name,
    onOptIn,
    onRemoved,
    showMessage: notice.showMessage,
  });
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  const handleSwitch = useCallback(
    (value: boolean) => {
      setOff(toolSwitchStep(off, toolId, value).off);
    },
    [off, toolId, setOff],
  );
  if (tool === undefined || catalogue === null)
    return (
      <SettingsFrame title={TOOLS_TITLE} onBack={onBack}>
        {null}
      </SettingsFrame>
    );
  const model = toolPageModel(tool, job, downloads, data);
  const overlay = (
    <>
      <ToolInstallBar
        dock={model.dock}
        sizeBytes={tool.sizeBytes}
        job={job}
        onInstall={actions.install}
        onOptIn={actions.optIn}
        onCancel={actions.cancel}
        onDismiss={actions.dismiss}
        onRemove={actions.askRemove}
        onOpen={onOpen}
      />
      <NoticeSnackbar
        notice={notice}
        bottom={insets.bottom + snackbar.aboveSheet}
      />
    </>
  );
  return (
    <SettingsFrame title={name} onBack={onBack} overlay={overlay}>
      <PageBody
        tool={tool}
        catalogue={catalogue}
        model={model}
        job={job}
        data={data}
        on={on.includes(toolId)}
        onSwitch={handleSwitch}
        onDeleteData={actions.askDeleteData}
      />
      <RemoveToolDialog
        visible={actions.asking === 'remove'}
        name={name}
        data={data}
        onConfirm={actions.confirmRemove}
        onCancel={actions.stopAsking}
      />
      <DeleteToolDataDialog
        visible={actions.asking === 'deleteData'}
        name={name}
        data={data}
        onConfirm={actions.confirmDeleteData}
        onCancel={actions.stopAsking}
      />
    </SettingsFrame>
  );
}
