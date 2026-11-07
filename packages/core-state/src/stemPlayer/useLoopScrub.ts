import { useCallback } from 'react';

import { loopMarks, loopNote } from './loopText.ts';
import type { StemPlayerStore } from './store.ts';
import { formatClock } from './time.ts';
import { formatClockSeconds } from '../text.ts';

type LoopScrubState = Pick<
  StemPlayerStore,
  | 'durationFrames'
  | 'engineRate'
  | 'loop'
  | 'loopFailure'
  | 'scrub'
  | 'cancelScrub'
  | 'seek'
>;

export function useLoopScrub(
  useSelect: <T>(selector: (state: LoopScrubState) => T) => T,
) {
  const durationFrames = useSelect((s) => s.durationFrames);
  const rate = useSelect((s) => s.engineRate);
  const loop = useSelect((s) => s.loop);
  const failure = useSelect((s) => s.loopFailure);
  const onScrub = useSelect((s) => s.scrub);
  const onCancel = useSelect((s) => s.cancelScrub);
  const onSeek = useSelect((s) => s.seek);
  const total = formatClock(durationFrames, rate);
  const spokenPosition = useCallback(
    (second: number) => `${formatClockSeconds(second)} of ${total}`,
    [total],
  );
  return {
    durationFrames,
    total,
    spokenPosition,
    marks: loopMarks(loop, rate, durationFrames),
    note: loopNote(loop, failure),
    onScrub,
    onCancel,
    onSeek,
  };
}
