import {
  bodyLineHeight,
  createThemedStyles,
  EditRow,
  LiveSlot,
  minTouchTargetDp,
  rig,
  Slider,
  textRoles,
  useTextScaled,
} from '@kitbag/core-design';
import { useMetronome } from '@kitbag/core-state';
import { KB_VOLUME_BOUNDS } from '@kitbag/core-native';
import { useCallback, useEffect } from 'react';
import { View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import {
  fractionOfVolume,
  VOLUME_SLIDER,
  volumeOfFraction,
  volumePercent,
} from './rigVolume.ts';
import { setLiveVolume } from './rigRuntime';

const LABEL = 'Click volume';
const WIDEST_READOUT = volumePercent(KB_VOLUME_BOUNDS.max);

const SLIDER_HIT_OVERHANG =
  (minTouchTargetDp - textRoles.editRowKey.size * bodyLineHeight) / 2;

const useStyles = createThemedStyles(() => ({
  slider: { width: rig.sliderWidth, marginVertical: -SLIDER_HIT_OVERHANG },
  readout: { minWidth: rig.readoutWidth },
}));

export function VolumeRow() {
  const styles = useStyles();
  const scaled = useTextScaled();
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
    <EditRow label={LABEL} singleLine={!scaled}>
      <View style={styles.slider}>
        <Slider
          value={fraction}
          onSlide={slide}
          onRelease={release}
          onCancel={cancel}
          step={VOLUME_SLIDER.step}
          mode={VOLUME_SLIDER.mode}
          look="level"
          tick={VOLUME_SLIDER.detent.at}
          detent={VOLUME_SLIDER.detent}
          warnAbove={VOLUME_SLIDER.warnAbove}
          accessibilityLabel={LABEL}
          accessibilityValue={volumePercent(volume)}
        />
      </View>
      <LiveSlot
        text={readout}
        role="levelReadout"
        widest={WIDEST_READOUT}
        align="right"
        style={styles.readout}
      />
    </EditRow>
  );
}
