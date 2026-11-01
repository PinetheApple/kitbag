import {
  createCalibrationSession,
  type CalibrationSessionStore,
} from '@kitbag/core-state';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { calibrationDeps } from './calibrationRuntime';

export function useCalibrationSession(): CalibrationSessionStore {
  const [session] = useState(() => createCalibrationSession(calibrationDeps));
  useFocusEffect(
    useCallback(() => {
      const { open, close } = session.getState();
      void open();
      const onAppState = (state: AppStateStatus) => {
        if (state === 'background') close();
        if (state === 'active' && session.getState().phase === 'idle') {
          void open();
        }
      };
      const subscription = AppState.addEventListener('change', onAppState);
      return () => {
        subscription.remove();
        close();
      };
    }, [session]),
  );
  return session;
}
