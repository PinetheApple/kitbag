import { getPracticeSessionStore, metronomeStore } from '@kitbag/core-state';
import { useEffect } from 'react';

import { leavePractice } from '../logic/practiceSummary.ts';

export function useEndPracticeOnLeave(): void {
  useEffect(
    () => () => {
      leavePractice(getPracticeSessionStore(), metronomeStore);
    },
    [],
  );
}
