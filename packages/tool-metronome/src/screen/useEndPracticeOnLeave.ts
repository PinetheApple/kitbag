import { getPracticeSessionStore, useMetronome } from '@kitbag/core-state';
import { useEffect } from 'react';

import { endPractice } from '../logic/practiceSummary.ts';

export function useEndPracticeOnLeave(): void {
  const resetPractice = useMetronome((state) => state.resetPractice);
  useEffect(
    () => () => {
      endPractice(getPracticeSessionStore(), resetPractice);
    },
    [resetPractice],
  );
}
