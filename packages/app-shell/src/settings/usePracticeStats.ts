import type { PracticeStats } from '@kitbag/core-db';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';

import { readPracticeStats } from '@/runtime/practiceRuntime';

export function usePracticeStats(): PracticeStats | null {
  const [stats, setStats] = useState<PracticeStats | null>(null);
  useFocusEffect(
    useCallback(() => {
      let focused = true;
      readPracticeStats().then(
        (next) => {
          if (focused) setStats(next);
        },
        (error: unknown) => {
          console.warn('[kitbag] could not read practice stats', error);
        },
      );
      return () => {
        focused = false;
      };
    }, []),
  );
  return stats;
}
