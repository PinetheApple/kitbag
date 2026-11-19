import {
  createThemedStyles,
  size,
  StepControl,
  type NeighbourGaps,
  type StepDelta,
} from '@kitbag/core-design';
import {
  isUnitySpeed,
  steppedKey,
  steppedSpeed,
  UNSHIFTED_KEY,
  useStemPlayer,
} from '@kitbag/core-state';
import { useCallback } from 'react';
import { View } from 'react-native';

import {
  keyText,
  speedKeyCopy,
  speedText,
  spokenKey,
} from '../logic/speedKeyView.ts';

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

const opener = (onOpen: (() => void) | undefined) =>
  onOpen === undefined ? {} : { onValuePress: onOpen };

export function SpeedStepper({ gaps, onOpen }: StepperProps) {
  const speed = useStemPlayer((s) => s.speed);
  const setSpeed = useStemPlayer((s) => s.setSpeed);
  const step = useCallback(
    (delta: StepDelta) => {
      void setSpeed(steppedSpeed(speed, delta));
    },
    [setSpeed, speed],
  );
  return (
    <StepControl
      variant="inlineLarge"
      label={speedKeyCopy.speed}
      value={speedText(speed)}
      accented={!isUnitySpeed(speed)}
      neighbourGapDp={gaps}
      onStep={step}
      {...opener(onOpen)}
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
      {...opener(onOpen)}
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
      <SpeedStepper gaps={gaps} onOpen={onOpen} />
      <SongKeyStepper gaps={gaps} onOpen={onOpen} />
    </View>
  );
}
