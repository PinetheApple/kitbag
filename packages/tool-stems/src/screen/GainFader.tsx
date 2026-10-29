import {
  createThemedStyles,
  minTouchTargetDp,
  Slider,
  stemPlayer,
  textRoles,
  textStyle,
} from '@kitbag/core-design';
import { useCallback, useEffect } from 'react';
import { Text, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import {
  FADER_ENDS,
  formatDb,
  fractionToGain,
  gainToFraction,
  UNITY_FRACTION,
} from '../logic/fader.ts';

const GAIN_STEP = 0.05;

const useStyles = createThemedStyles((theme) => ({
  lane: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: stemPlayer.faderGap,
    minHeight: stemPlayer.faderLane,
    paddingHorizontal: stemPlayer.faderH,
    paddingBottom: stemPlayer.faderBottom,
  },
  slider: {
    flex: 1,
    marginVertical: (stemPlayer.faderLane - minTouchTargetDp) / 2,
  },
  end: { ...textStyle(textRoles.faderEnd), color: theme.color.text3 },
}));

interface GainFaderProps {
  readonly label: string;
  readonly gain: number;
  readonly onGain: (gain: number) => void;
}

export function GainFader({ label, gain, onGain }: GainFaderProps) {
  const styles = useStyles();
  const fraction = useSharedValue(gainToFraction(gain));
  useEffect(() => {
    fraction.value = gainToFraction(gain);
  }, [fraction, gain]);
  const slide = useCallback(
    (at: number) => {
      onGain(fractionToGain(at));
    },
    [onGain],
  );
  return (
    <View style={styles.lane}>
      <Text style={styles.end} importantForAccessibility="no">
        {FADER_ENDS.low}
      </Text>
      <View style={styles.slider}>
        <Slider
          value={fraction}
          onSlide={slide}
          onRelease={slide}
          step={GAIN_STEP}
          mode="fader"
          tick={UNITY_FRACTION}
          accessibilityLabel={`${label} volume`}
          accessibilityValue={formatDb(gain)}
        />
      </View>
      <Text style={styles.end} importantForAccessibility="no">
        {FADER_ENDS.high}
      </Text>
    </View>
  );
}
