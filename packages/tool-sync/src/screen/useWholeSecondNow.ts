import { boottimeNowMs } from '@kitbag/core-native';
import { useEffect, useState } from 'react';

import { msToNextWholeSecond } from '../logic/secondTicks.ts';

export function useWholeSecondNow(sinceMs: number | undefined): number {
  const [now, setNow] = useState(boottimeNowMs);

  useEffect(() => {
    if (sinceMs === undefined) return;
    setNow(boottimeNowMs());
    let tick: ReturnType<typeof setTimeout> | undefined;
    const schedule = () => {
      tick = setTimeout(
        () => {
          setNow(boottimeNowMs());
          schedule();
        },
        msToNextWholeSecond(sinceMs, boottimeNowMs()),
      );
    };
    schedule();
    return () => {
      clearTimeout(tick);
    };
  }, [sinceMs]);

  return now;
}
