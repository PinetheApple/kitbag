import { PlayerDock } from '@kitbag/core-design';
import type { MixerFrameValues } from '@kitbag/core-plugin-api';
import {
  loopEndFrames,
  useStemHeldFrame,
  useStemPlayer,
  useStemViewing,
} from '@kitbag/core-state';

import { useStemsHost } from '../host.ts';
import { useStemPresses } from './playerRoutes.ts';
import { Scrubber } from './Scrubber.tsx';
import { SpeedKeyControls } from './SpeedKeyControls.tsx';
import { StemTransport } from './StemTransport.tsx';

export interface DockProps {
  readonly frame: MixerFrameValues;
  readonly bottom: number;
  readonly onOpenUpNext: () => void;
  readonly onSpeedKey: () => void;
}

export function Dock({ frame, bottom, onOpenUpNext, onSpeedKey }: DockProps) {
  const { UpNextRow } = useStemsHost().listening;
  const presses = useStemPresses();
  const viewing = useStemViewing();
  return (
    <PlayerDock bottomInset={bottom}>
      {viewing ? null : (
        <UpNextRow
          songSec={frame.songSec}
          onOpenSheet={onOpenUpNext}
          {...presses}
        />
      )}
      <Scrubber frame={frame} />
      <SpeedKeyControls onOpen={onSpeedKey} />
      <StemTransport playing={frame.playing} />
    </PlayerDock>
  );
}

export function useStemFrame(viewing: boolean): MixerFrameValues {
  const { useMixerFrame } = useStemsHost().listening;
  const rate = useStemPlayer((s) => s.engineRate);
  const frames = useStemPlayer((s) => s.durationFrames);
  const loopEnd = useStemPlayer(loopEndFrames);
  const countEnd = useStemPlayer((s) => s.countEndFrame);
  const held = useStemHeldFrame(viewing);
  return useMixerFrame(rate, frames, loopEnd, {
    countEndFrame: countEnd,
    heldFrame: held,
  });
}
