import { useCallback, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import { metronomeSheet } from '../metronomeRoles.ts';
import { radius, size, space, textRoles } from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import {
  commonMeters,
  numeratorChoices,
  sameMeter,
  spokenTimeSignature,
  timeSignatureLabel,
  type Meter,
} from '../timeSignature.ts';
import { minTouchTargetDp } from '../tokens.ts';
import { hitBoxStyle, hitExtension } from '../touchTarget.ts';
import { Button } from './Button.tsx';
import { usePickedTileStyles } from './pickedTileStyles.ts';
import { Sheet } from './Sheet.tsx';
import { SheetHint } from './SheetHint.tsx';
import { WheelPicker } from './WheelPicker.tsx';

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
  const pickedStyles = usePickedTileStyles();
  const handlePress = useCallback(() => {
    onPick(meter);
  }, [onPick, meter]);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={spokenTimeSignature(meter)}
      accessibilityState={{ checked: selected }}
      style={PICK_HIT_BOX}
      onPress={handlePress}
    >
      <View style={[styles.pick, selected && pickedStyles.selectedTile]}>
        <Text style={styles.pickLabel}>{timeSignatureLabel(meter)}</Text>
      </View>
    </Pressable>
  );
}

function useMeterDraft(beatsPerBar: number, denominator: number) {
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

export interface TimeSignatureSheetProps {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly beatsPerBar: number;
  readonly denominator: number;
  readonly maxBeats: number;
  readonly denominators: readonly number[];
  readonly onSet: (beatsPerBar: number, denominator: number) => void;
  readonly onDismiss: () => void;
}

export function TimeSignatureSheet({
  visible,
  bottomInset,
  beatsPerBar,
  denominator,
  maxBeats,
  denominators,
  onSet,
  onDismiss,
}: TimeSignatureSheetProps) {
  const styles = useStyles();
  const numerators = useMemo(() => numeratorChoices(maxBeats), [maxBeats]);
  const common = useMemo(
    () => commonMeters(maxBeats, denominators),
    [maxBeats, denominators],
  );
  const { draft, reset, setDraft, setBeats, setDenominator } = useMeterDraft(
    beatsPerBar,
    denominator,
  );
  const handleSet = useCallback(() => {
    onSet(draft.beats, draft.denominator);
    onDismiss();
  }, [onSet, draft, onDismiss]);
  return (
    <Sheet
      visible={visible}
      title="Time signature"
      dismissLabel="Close time signature"
      bottomInset={bottomInset}
      dim
      onShow={reset}
      onDismiss={onDismiss}
      footer={
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
            label={`Set ${timeSignatureLabel(draft)}`}
            accessibilityLabel={`Set ${spokenTimeSignature(draft)}`}
            onPress={handleSet}
          />
        </View>
      }
    >
      <View style={styles.wheels}>
        <WheelPicker
          accessibilityLabel="Beats per bar"
          values={numerators}
          selected={draft.beats}
          onSelect={setBeats}
        />
        <Text importantForAccessibility="no" style={styles.slash}>
          /
        </Text>
        <WheelPicker
          accessibilityLabel="Note value"
          values={denominators}
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
        {common.map((meter) => (
          <CommonPick
            key={timeSignatureLabel(meter)}
            meter={meter}
            selected={sameMeter(meter, draft)}
            onPick={setDraft}
          />
        ))}
      </View>
    </Sheet>
  );
}
