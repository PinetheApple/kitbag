import {
  Button,
  createThemedStyles,
  opacity,
  radius,
  Sheet,
  SheetHint,
  size,
  space,
  StepControl,
  textRoles,
  textStyle,
  type StepDelta,
} from '@kitbag/core-design';
import { KB_MAX_MUTE_BARS } from '@kitbag/core-native';
import { useMetronome } from '@kitbag/core-state';
import { useCallback, useMemo } from 'react';
import { Text, View } from 'react-native';

import { barBounds, mutePreview, stepWithin } from '../logic/trainer.ts';

const MUTE_BARS = barBounds(KB_MAX_MUTE_BARS);

const useStyles = createThemedStyles((theme) => ({
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.controlGap,
  },
  label: {
    ...textStyle(textRoles.fieldLabel),
    color: theme.color.text2,
  },
  preview: {
    flexDirection: 'row',
    gap: space.barPreviewGap,
  },
  bar: {
    flex: 1,
    height: size.barPreview,
    borderRadius: radius.barPreview,
  },
  sounding: {
    backgroundColor: theme.color.accent,
    opacity: opacity.barPreviewSounding,
  },
  silent: {
    backgroundColor: theme.color.surface3,
  },
  actions: {
    flexDirection: 'row',
    gap: space.controlGap,
  },
}));

interface MuteBarsSheetProps {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly onDismiss: () => void;
}

export function MuteBarsSheet({
  visible,
  bottomInset,
  onDismiss,
}: MuteBarsSheetProps) {
  const styles = useStyles();
  const barMute = useMetronome((s) => s.barMute);
  const setBarMute = useMetronome((s) => s.setBarMute);

  const preview = useMemo(
    () => mutePreview(barMute.playBars, barMute.muteBars),
    [barMute.playBars, barMute.muteBars],
  );
  const previewLabel = preview
    .map((sounding) => (sounding ? 'play' : 'mute'))
    .join(', ');

  const handlePlayStep = useCallback(
    (delta: StepDelta) => {
      setBarMute({
        ...barMute,
        playBars: stepWithin(barMute.playBars, delta, MUTE_BARS),
      });
    },
    [barMute, setBarMute],
  );
  const handleMuteStep = useCallback(
    (delta: StepDelta) => {
      setBarMute({
        ...barMute,
        muteBars: stepWithin(barMute.muteBars, delta, MUTE_BARS),
      });
    },
    [barMute, setBarMute],
  );
  const handleOff = useCallback(() => {
    setBarMute({ ...barMute, enabled: false });
    onDismiss();
  }, [barMute, setBarMute, onDismiss]);
  const handleApply = useCallback(() => {
    setBarMute({ ...barMute, enabled: true });
    onDismiss();
  }, [barMute, setBarMute, onDismiss]);

  return (
    <Sheet
      visible={visible}
      title="Mute bars"
      titleIcon="muteBars"
      dismissLabel="Close mute bars"
      bottomInset={bottomInset}
      onDismiss={onDismiss}
    >
      <View style={styles.row}>
        <Text style={styles.label}>Play</Text>
        <StepControl
          variant="inline"
          label="Bars to play"
          value={String(barMute.playBars)}
          onStep={handlePlayStep}
        />
        <Text style={styles.label}>then mute</Text>
        <StepControl
          variant="inline"
          label="Bars to mute"
          value={String(barMute.muteBars)}
          onStep={handleMuteStep}
        />
      </View>
      <View
        accessible
        accessibilityLabel={`Eight bars of the cycle: ${previewLabel}`}
        style={styles.preview}
      >
        {preview.map((sounding, bar) => (
          <View
            key={bar}
            style={[styles.bar, sounding ? styles.sounding : styles.silent]}
          />
        ))}
      </View>
      <SheetHint>
        Preview shows eight bars of the cycle. Silent bars still light the LEDs
        — you keep the visual, lose the click.
      </SheetHint>
      <View style={styles.actions}>
        <Button
          fill
          variant="ghost"
          label="Off"
          disabled={!barMute.enabled}
          onPress={handleOff}
        />
        <Button fill variant="primary" label="Apply" onPress={handleApply} />
      </View>
    </Sheet>
  );
}
