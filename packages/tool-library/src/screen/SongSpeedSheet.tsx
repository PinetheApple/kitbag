import { Sheet, SpeedGroup, type StepDelta } from '@kitbag/core-design';
import {
  bpmFact,
  isUnitySpeed,
  speedHint,
  speedKeyCopy,
  speedPercentText,
  speedPresetTexts,
  steppedSpeed,
  useSongPlayer,
  type SongFacts,
} from '@kitbag/core-state';
import { useCallback, useMemo } from 'react';

import { playedBpm } from '../logic/playedBpm.ts';
import { SONG_SPEED_TEXT } from '../logic/viewText.ts';

export interface SongSpeedSheetProps {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly onClose: () => void;
}

const factsAt = (bpm: number | null): SongFacts => ({
  bpm: bpmFact(bpm),
  key: null,
  tempo: null,
});

export function SongSpeedSheet({
  visible,
  bottomInset,
  onClose,
}: SongSpeedSheetProps) {
  const speed = useSongPlayer((s) => s.speed);
  const bpm = useSongPlayer((s) => s.bpm);
  const setSpeed = useSongPlayer((s) => s.setSpeed);
  const step = useCallback(
    (delta: StepDelta) => {
      void setSpeed(steppedSpeed(speed, delta));
    },
    [setSpeed, speed],
  );
  const pick = useCallback(
    (picked: number) => {
      void setSpeed(picked);
    },
    [setSpeed],
  );
  const presets = useMemo(() => speedPresetTexts(speed), [speed]);
  return (
    <Sheet
      visible={visible}
      title={SONG_SPEED_TEXT.title}
      dismissLabel={SONG_SPEED_TEXT.close}
      bottomInset={bottomInset}
      onDismiss={onClose}
    >
      <SpeedGroup
        label={speedKeyCopy.speed}
        value={speedPercentText(speed)}
        accented={!isUnitySpeed(speed)}
        presets={presets}
        hint={speedHint(factsAt(bpm), factsAt(playedBpm(bpm, speed)))}
        onStep={step}
        onPick={pick}
      />
    </Sheet>
  );
}
