import { dataFolderStore, useDataFolder } from '@kitbag/core-state';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState, useSyncExternalStore } from 'react';

import { dataFolderSheet, sheetActions } from './dataFolderFlow.ts';
import { createDataFolderSheetController } from './dataFolderSheetController.ts';

export function useDataFolderSheets(onNotice: (text: string) => void) {
  const [controller] = useState(() =>
    createDataFolderSheetController(dataFolderStore, onNotice),
  );
  const step = useSyncExternalStore(controller.subscribe, controller.step);
  const move = useDataFolder((s) => s.move);
  const error = useDataFolder((s) => s.error);
  const pending = useDataFolder((s) => s.pending);
  const codes = useDataFolder((s) => s.codes);
  const sheet = dataFolderSheet({ move, error }, step);

  useFocusEffect(
    useCallback(() => {
      void dataFolderStore.getState().refreshVolumes();
    }, []),
  );

  return {
    sheet,
    actions: sheetActions(sheet, pending),
    pending,
    codes,
    confirmTarget:
      step.kind === 'confirm' || step.kind === 'starting' ? step.target : null,
    open: controller.open,
    close: controller.close,
    choose: controller.choose,
    byAction: controller.act,
  };
}
