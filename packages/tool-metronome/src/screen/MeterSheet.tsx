import {
  Button,
  createThemedStyles,
  hitBoxStyle,
  hitExtension,
  metronomeSheet,
  minTouchTargetDp,
  radius,
  Sheet,
  SheetHint,
  size,
  space,
  textRoles,
  textStyle,
  WheelPicker,
} from '@kitbag/core-design';
import { KB_DENOMINATORS, KB_MAX_BEATS } from '@kitbag/core-native';
import { useMetronome } from '@kitbag/core-state';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  commonMeters,
  meterLabel,
  numeratorChoices,
  sameMeter,
  spokenMeter,
  type Meter,
} from '../logic/meter.ts';
import { useSheetStyles } from './sheetStyles.ts';

const NUMERATORS = numeratorChoices(KB_MAX_BEATS);
const COMMON = commonMeters(KB_MAX_BEATS, KB_DENOMINATORS);
const PICK_HIT_BOX = hitBoxStyle(
  hitExtension(minTouchTargetDp, metronomeSheet.meterPick, {
    top: space.controlGap,
    bottom: space.controlGap,
  }),
);

const useStyles = createThemedStyles((theme) => ({
  wheels: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: metronomeSheet.wheelGap,
    paddingVertical: metronomeSheet.wheelRowV,
  },
  slash: {
    ...textStyle(textRoles.meterSlash),
    color: theme.color.text3,
  },
  common: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: space.controlGap,
  },
  pick: {
    minHeight: metronomeSheet.meterPick,
    minWidth: metronomeSheet.meterPickMin,
    paddingHorizontal: metronomeSheet.meterPickH,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.pick,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface2,
  },
  pickLabel: {
    ...textStyle(textRoles.meterPick),
    color: theme.color.text,
  },
  actions: {
    flexDirection: 'row',
    gap: space.controlGap,
  },
}));

interface CommonPickProps {
  readonly meter: Meter;
  readonly selected: boolean;
  readonly onPick: (meter: Meter) => void;
}

function CommonPick({ meter, selected, onPick }: CommonPickProps) {
  const styles = useStyles();
  const sheetStyles = useSheetStyles();
  const handlePress = useCallback(() => {
    onPick(meter);
  }, [onPick, meter]);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={spokenMeter(meter)}
      accessibilityState={{ checked: selected }}
      style={PICK_HIT_BOX}
      onPress={handlePress}
    >
      <View style={[styles.pick, selected && sheetStyles.selectedTile]}>
        <Text style={styles.pickLabel}>{meterLabel(meter)}</Text>
      </View>
    </Pressable>
  );
}

function useMeterDraft() {
  const beatsPerBar = useMetronome((s) => s.beatsPerBar);
  const denominator = useMetronome((s) => s.denominator);
  const [draft, setDraft] = useState<Meter>({
    beats: beatsPerBar,
    denominator,
  });
  const reset = useCallback(() => {
    setDraft({ beats: beatsPerBar, denominator });
  }, [beatsPerBar, denominator]);
  const setBeats = useCallback((beats: number) => {
    setDraft((d) => ({ ...d, beats }));
  }, []);
  const setDenominator = useCallback((next: number) => {
    setDraft((d) => ({ ...d, denominator: next }));
  }, []);
  return { draft, reset, setDraft, setBeats, setDenominator };
}

interface MeterSheetProps {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly onDismiss: () => void;
}

export function MeterSheet({
  visible,
  bottomInset,
  onDismiss,
}: MeterSheetProps) {
  const styles = useStyles();
  const applyMeter = useMetronome((s) => s.setBeats);
  const { draft, reset, setDraft, setBeats, setDenominator } = useMeterDraft();
  const handleSet = useCallback(() => {
    applyMeter(draft.beats, draft.denominator);
    onDismiss();
  }, [applyMeter, draft, onDismiss]);
  return (
    <Sheet
      visible={visible}
      title="Time signature"
      dismissLabel="Close time signature"
      bottomInset={bottomInset}
      dim
      onShow={reset}
      onDismiss={onDismiss}
    >
      <View style={styles.wheels}>
        <WheelPicker
          accessibilityLabel="Beats per bar"
          values={NUMERATORS}
          selected={draft.beats}
          onSelect={setBeats}
        />
        <Text importantForAccessibility="no" style={styles.slash}>
          /
        </Text>
        <WheelPicker
          accessibilityLabel="Note value"
          values={KB_DENOMINATORS}
          selected={draft.denominator}
          onSelect={setDenominator}
        />
      </View>
      <SheetHint centered size="large">
        Common
      </SheetHint>
      <View
        accessibilityRole="radiogroup"
        accessibilityLabel="Common time signatures"
        style={styles.common}
      >
        {COMMON.map((meter) => (
          <CommonPick
            key={meterLabel(meter)}
            meter={meter}
            selected={sameMeter(meter, draft)}
            onPick={setDraft}
          />
        ))}
      </View>
      <View style={styles.actions}>
        <Button
          fill
          size="sheet"
          variant="ghost"
          label="Cancel"
          onPress={onDismiss}
        />
        <Button
          fill
          size="sheet"
          variant="primary"
          label={`Set ${meterLabel(draft)}`}
          accessibilityLabel={`Set ${spokenMeter(draft)}`}
          onPress={handleSet}
        />
      </View>
    </Sheet>
  );
}
