import { ScrubRow } from '@kitbag/core-design';
import {
  formatClock,
  formatClockSeconds,
  loopMarks,
  loopNote,
  useStemPlayer,
} from '@kitbag/core-state';
import { useCallback } from 'react';

import type { MixerFrameValues } from './useMixerFrame.ts';

export function Scrubber({ frame }: { readonly frame: MixerFrameValues }) {
  const frames = useStemPlayer((s) => s.durationFrames);
  const rate = useStemPlayer((s) => s.engineRate);
  const loop = useStemPlayer((s) => s.loop);
  const failure = useStemPlayer((s) => s.loopFailure);
  const scrub = useStemPlayer((s) => s.scrub);
  const cancelScrub = useStemPlayer((s) => s.cancelScrub);
  const seek = useStemPlayer((s) => s.seek);
  const total = formatClock(frames, rate);
  const spokenPosition = useCallback(
    (second: number) => `${formatClockSeconds(second)} of ${total}`,
    [total],
  );
  return (
    <ScrubRow
      frame={frame}
      durationFrames={frames}
      total={total}
      spokenPosition={spokenPosition}
      marks={loopMarks(loop, rate, frames)}
      note={loopNote(loop, failure)}
      onScrub={scrub}
      onCancel={cancelScrub}
      onSeek={seek}
    />
  );
}
