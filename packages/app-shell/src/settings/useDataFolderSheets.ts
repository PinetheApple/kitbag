import type {
  DataFolderCodes,
  DataFolderVolumes,
  MoveStatus,
} from '@kitbag/core-native';
import {
  dataFolderStore,
  resumeBlocked,
  returnSourceMissing,
  useDataFolder,
} from '@kitbag/core-state';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState, useSyncExternalStore } from 'react';

import {
  dataFolderSheet,
  sheetActions,
  type DataFolderAction,
  type DataFolderSheet,
  type SheetAction,
} from './dataFolderFlow.ts';
import { createDataFolderSheetController } from './dataFolderSheetController.ts';
import type { Places } from './dataFolderMoveText.ts';

export interface DataFolderSheetsModel {
  readonly sheet: DataFolderSheet;
  readonly actions: readonly SheetAction[];
  readonly pending: boolean;
  readonly codes: DataFolderCodes | null;
  readonly volumes: DataFolderVolumes | null;
  readonly move: MoveStatus | null;
  readonly error: string | null;
  readonly sourceMissing: boolean;
  readonly places: Places;
  readonly open: () => void;
  readonly offerReturn: (volumeUuid: string) => void;
  readonly close: () => void;
  readonly choose: (target: string | null) => void;
  readonly act: Readonly<Record<DataFolderAction, () => void>>;
}

export function useDataFolderSheets(
  onNotice: (text: string) => void,
): DataFolderSheetsModel {
  const [controller] = useState(() =>
    createDataFolderSheetController(dataFolderStore, onNotice),
  );
  const step = useSyncExternalStore(controller.subscribe, controller.step);
  const volumes = useDataFolder((s) => s.volumes);
  const move = useDataFolder((s) => s.move);
  const error = useDataFolder((s) => s.error);
  const pending = useDataFolder((s) => s.pending);
  const codes = useDataFolder((s) => s.codes);
  const sourceMissing = useDataFolder(returnSourceMissing);
  const blocked = useDataFolder(resumeBlocked);
  const returning = controller.returning();
  const sheet = dataFolderSheet({ move, error, volumes, returning }, step);

  useFocusEffect(
    useCallback(() => {
      controller.setFocused(true);
      void dataFolderStore.getState().refreshVolumes();
      return () => {
        controller.setFocused(false);
      };
    }, [controller]),
  );

  return {
    sheet,
    actions: sheetActions(sheet, pending).map((action) =>
      action.id === 'resume' ? { ...action, disabled: blocked } : action,
    ),
    sourceMissing,
    pending,
    codes,
    volumes,
    move,
    error,
    places: controller.places(),
    open: controller.open,
    offerReturn: controller.offerReturn,
    close: controller.close,
    choose: controller.choose,
    act: controller.act,
  };
}
