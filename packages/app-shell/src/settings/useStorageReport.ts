import { DATABASE_NAME } from '@kitbag/core-db';
import { storageReport, type StorageReport } from '@kitbag/core-native';
import { useFocusEffect } from 'expo-router';
import { useCallback, useRef, useState } from 'react';

const readReport = async () => storageReport(DATABASE_NAME);

export function useStorageReport() {
  const [report, setReport] = useState<StorageReport | null>(null);
  const latest = useRef(0);
  const refresh = useCallback(() => {
    latest.current += 1;
    const request = latest.current;
    readReport().then(
      (next) => {
        if (request === latest.current) setReport(next);
      },
      (error: unknown) => {
        console.warn('[kitbag] could not read storage', error);
      },
    );
  }, []);
  useFocusEffect(
    useCallback(() => {
      refresh();
      return () => {
        latest.current += 1;
      };
    }, [refresh]),
  );
  return { report, refresh };
}
