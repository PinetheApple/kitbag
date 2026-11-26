import {
  createThemedStyles,
  displayDigits,
  entryLabel,
  FACT_SEPARATOR,
  NumpadKeypad,
  PresetButton,
  Sheet,
  SheetHint,
  space,
  textRoles,
  textStyle,
  type NumpadEntry,
} from '@kitbag/core-design';
import {
  BPM_BOUNDS,
  doubledBpm,
  halvedBpm,
  TAPS_TO_SET_TEMPO,
  useTempoLadder,
} from '@kitbag/core-state';
import { Text, View } from 'react-native';

import { tapsLeftHint } from '../logic/tapPad.ts';
import { NO_TEMPO_NUMERAL } from '../logic/tempoLine.ts';
import { TapLeds } from './TapPad.tsx';
import { useTempoEntry } from './useTempoEntry.ts';

const TITLE = 'Tempo';
const UNIT = 'BPM';

const useStyles = createThemedStyles((theme) => ({
  entry: {
    ...textStyle(textRoles.sheetNumeral),
    color: theme.color.text,
    textAlign: 'center',
  },
  tapping: { alignItems: 'center', gap: space.controlGap },
  presets: { flexDirection: 'row', gap: space.controlGap },
}));

interface TapReadoutProps {
  readonly bpm: number | null;
  readonly tapsLanded: number;
}

function TapReadout({ bpm, tapsLanded }: TapReadoutProps) {
  const styles = useStyles();
  const set = tapsLanded >= TAPS_TO_SET_TEMPO && bpm !== null;
  return (
    <View style={styles.tapping}>
      <Text style={styles.entry} accessibilityLiveRegion="polite">
        {set ? String(bpm) : NO_TEMPO_NUMERAL}
      </Text>
      <TapLeds landed={tapsLanded} />
      <SheetHint centered size="large">
        {set ? `${String(bpm)} ${UNIT}` : tapsLeftHint(tapsLanded)}
      </SheetHint>
    </View>
  );
}

function TypedReadout({ entry }: { readonly entry: NumpadEntry }) {
  const styles = useStyles();
  return (
    <View>
      <Text
        style={styles.entry}
        accessibilityLiveRegion="polite"
        accessibilityLabel={entryLabel(entry, TITLE, UNIT)}
      >
        {displayDigits(entry)}
      </Text>
      <SheetHint centered size="large">
        {BPM_BOUNDS.min} – {BPM_BOUNDS.max} {UNIT}
      </SheetHint>
    </View>
  );
}

interface StepPresetsProps {
  readonly bpm: number | null;
  readonly onHalve: () => void;
  readonly onDouble: () => void;
  readonly onTap: () => void;
}

function StepPresets({ bpm, onHalve, onDouble, onTap }: StepPresetsProps) {
  const styles = useStyles();
  return (
    <View style={styles.presets}>
      {bpm === null ? null : (
        <>
          <PresetButton
            label={`÷2${FACT_SEPARATOR}${String(halvedBpm(bpm))}`}
            accessibilityLabel={`Half time, ${String(halvedBpm(bpm))} ${UNIT}`}
            onPress={onHalve}
          />
          <PresetButton
            label={`×2${FACT_SEPARATOR}${String(doubledBpm(bpm))}`}
            accessibilityLabel={`Double time, ${String(doubledBpm(bpm))} ${UNIT}`}
            onPress={onDouble}
          />
        </>
      )}
      <PresetButton
        kind="action"
        label="Tap"
        accessibilityLabel="Tap tempo"
        onPress={onTap}
      />
    </View>
  );
}

export interface TempoSheetProps {
  readonly visible: boolean;
  readonly sourceWords: string;
  readonly bottomInset: number;
  readonly onDismiss: () => void;
}

export function TempoSheet({
  visible,
  sourceWords,
  bottomInset,
  onDismiss,
}: TempoSheetProps) {
  const tempo = useTempoEntry(onDismiss);
  const tapsLanded = useTempoLadder((s) => s.tapsLanded);
  const { shownBpm } = tempo;
  return (
    <Sheet
      visible={visible}
      title={TITLE}
      titleDetail={
        shownBpm === null ? undefined : `was ${String(shownBpm)} ${sourceWords}`
      }
      dismissLabel="Close tempo entry"
      bottomInset={bottomInset}
      dim
      onShow={tempo.onShow}
      onDismiss={onDismiss}
    >
      {tempo.tapping ? (
        <TapReadout bpm={tempo.bpm} tapsLanded={tapsLanded} />
      ) : (
        <TypedReadout entry={tempo.entry} />
      )}
      <StepPresets {...tempo} />
      <NumpadKeypad
        size="large"
        onDigit={tempo.onDigit}
        onBackspace={tempo.onBackspace}
        onConfirm={tempo.onConfirm}
        backspaceLabel="Delete digit"
        confirmLabel="Set tempo"
      />
    </Sheet>
  );
}
