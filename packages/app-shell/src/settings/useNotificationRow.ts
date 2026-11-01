import { useNotificationPermission } from '@kitbag/core-state';
import { useFocusEffect } from 'expo-router';
import { useCallback, useEffect } from 'react';
import { AppState } from 'react-native';

import { notificationRow } from './notificationText.ts';

export function useNotificationRow() {
  const required = useNotificationPermission((s) => s.required);
  const granted = useNotificationPermission((s) => s.granted);
  const ask = useNotificationPermission((s) => s.ask);
  const refresh = useNotificationPermission((s) => s.refresh);
  const enable = useNotificationPermission((s) => s.enable);
  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refresh();
    });
    return () => {
      subscription.remove();
    };
  }, [refresh]);
  const handleEnable = useCallback(() => {
    void enable();
  }, [enable]);
  return {
    row: notificationRow({ required, granted, ask }),
    enable: handleEnable,
  };
}
