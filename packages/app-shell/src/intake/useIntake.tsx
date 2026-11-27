import { snackbar, Snackbar } from '@kitbag/core-design';
import {
  getToolsStore,
  restoreStore,
  songLibraryStore,
} from '@kitbag/core-state';
import { router, type Href } from 'expo-router';
import { useCallback, useEffect, useState, type ReactElement } from 'react';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { intakeFiles, intakeSource } from '@/runtime/intakeRuntime';

import { toolOnTest } from '../home/toolsOn.ts';
import { receiveIntake, type IntakeDeps } from './receive.ts';
import { intakeSession } from './session.ts';

const session = intakeSession(intakeSource);

function intakeDeps(notify: (message: string) => void): IntakeDeps {
  return {
    ...intakeFiles,
    isOn: (toolId) => toolOnTest(getToolsStore().getState().off)(toolId),
    navigate: (route) => {
      router.navigate(route as Href);
    },
    notify,
    importDocuments: (docs) =>
      songLibraryStore.getState().importDocuments(docs),
    openBackup: (read) => restoreStore.getState().open(read),
  };
}

export function useIntake(): ReactElement | null {
  const insets = useSafeAreaInsets();
  const [notice, setNotice] = useState<string | null>(null);
  const clearNotice = useCallback(() => {
    setNotice(null);
  }, []);
  useEffect(
    () =>
      session.start((intake) => receiveIntake(intake, intakeDeps(setNotice))),
    [],
  );
  if (notice === null) return null;
  return (
    <Snackbar
      message={notice}
      bottom={insets.bottom + snackbar.aboveSheet}
      onTimeout={clearNotice}
    />
  );
}
