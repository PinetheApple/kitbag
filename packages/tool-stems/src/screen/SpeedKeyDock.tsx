import {
  createThemedStyles,
  size,
  SpeedStepper,
  StepControl,
  type NeighbourGaps,
  type StepDelta,
} from '@kitbag/core-design';
import {
  isUnitySpeed,
  keyText,
  speedKeyCopy,
  speedPercentText,
  steppedKey,
  steppedSpeed,
  UNSHIFTED_KEY,
  useStemPlayer,
} from '@kitbag/core-state';
import { useCallback } from 'react';
import { View } from 'react-native';

import { spokenKey } from '../logic/stemKeyText.ts';

const useStyles = createThemedStyles(() => ({
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: size.stepInlineLarge,
  },
}));

interface StepperProps {
  readonly gaps: number | NeighbourGaps;
  readonly onOpen?: () => void;
}

export function usePlayerSpeedStep() {
  const speed = useStemPlayer((s) => s.speed);
  const setSpeed = useStemPlayer((s) => s.setSpeed);
  const step = useCallback(
    (delta: StepDelta) => {
      void setSpeed(steppedSpeed(speed, delta));
    },
    [setSpeed, speed],
  );
  return { speed, step };
}

function PlayerSpeedStepper({ gaps, onOpen }: StepperProps) {
  const { speed, step } = usePlayerSpeedStep();
  return (
    <SpeedStepper
      label={speedKeyCopy.speed}
      value={speedPercentText(speed)}
      accented={!isUnitySpeed(speed)}
      gaps={gaps}
      onStep={step}
      onOpen={onOpen}
    />
  );
}

export function SongKeyStepper({ gaps, onOpen }: StepperProps) {
  const songKey = useStemPlayer((s) => s.songKey);
  const setSongKey = useStemPlayer((s) => s.setSongKey);
  const step = useCallback(
    (delta: StepDelta) => {
      void setSongKey(steppedKey(songKey, delta));
    },
    [setSongKey, songKey],
  );
  return (
    <StepControl
      variant="inlineLarge"
      label={speedKeyCopy.songKey}
      value={keyText(songKey)}
      accessibilityValue={spokenKey(songKey)}
      accented={songKey !== UNSHIFTED_KEY}
      neighbourGapDp={gaps}
      onStep={step}
      onValuePress={onOpen}
    />
  );
}

export function SpeedKeyDock({
  gaps,
  onOpen,
}: StepperProps & { readonly onOpen: () => void }) {
  const styles = useStyles();
  return (
    <View style={styles.line}>
      <PlayerSpeedStepper gaps={gaps} onOpen={onOpen} />
      <SongKeyStepper gaps={gaps} onOpen={onOpen} />
    </View>
  );
}
