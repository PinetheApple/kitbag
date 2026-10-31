import {
  bodyLineHeight,
  createThemedStyles,
  EditRow,
  LiveText,
  minTouchTargetDp,
  rig,
  Slider,
  textRoles,
} from '@kitbag/core-design';
import { useMetronome } from '@kitbag/core-state';
import { useCallback, useEffect } from 'react';
import { View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import {
  fractionOfVolume,
  VOLUME_SLIDER,
  volumeOfFraction,
  volumePercent,
} from './rigText.ts';
import { setLiveVolume } from './rigRuntime';

const LABEL = 'Click volume';

// The slider's 48dp hit area overhangs the row instead of making it taller.
const HIT_OVERHANG =
  (minTouchTargetDp - textRoles.editRowKey.size * bodyLineHeight) / 2;

const useStyles = createThemedStyles(() => ({
  slider: { width: rig.sliderWidth, marginVertical: -HIT_OVERHANG },
  readout: { width: rig.readoutWidth },
}));

export function VolumeRow() {
  const styles = useStyles();
  const volume = useMetronome((s) => s.volume);
  const setVolume = useMetronome((s) => s.setVolume);
  const fraction = useSharedValue(fractionOfVolume(volume));
  const readout = useSharedValue(volumePercent(volume));
  useEffect(() => {
    fraction.value = fractionOfVolume(volume);
    readout.value = volumePercent(volume);
  }, [fraction, readout, volume]);
  const slide = useCallback(
    (at: number) => {
      const next = volumeOfFraction(at);
      readout.value = volumePercent(next);
      setLiveVolume(next);
    },
    [readout],
  );
  const release = useCallback(
    (at: number) => {
      setVolume(volumeOfFraction(at));
    },
    [setVolume],
  );
  const cancel = useCallback(() => {
    setLiveVolume(volume);
    readout.value = volumePercent(volume);
  }, [readout, volume]);
  return (
    <EditRow label={LABEL} singleLine>
      <View style={styles.slider}>
        <Slider
          value={fraction}
          onSlide={slide}
          onRelease={release}
          onCancel={cancel}
          step={VOLUME_SLIDER.step}
          mode="fader"
          look="level"
          tick={VOLUME_SLIDER.detent.at}
          detent={VOLUME_SLIDER.detent}
          warnAbove={VOLUME_SLIDER.warnAbove}
          accessibilityLabel={LABEL}
          accessibilityValue={volumePercent(volume)}
        />
      </View>
      <LiveText
        text={readout}
        role="levelReadout"
        align="right"
        style={styles.readout}
      />
    </EditRow>
  );
}
