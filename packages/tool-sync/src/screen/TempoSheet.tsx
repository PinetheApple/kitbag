import {
  createThemedStyles,
  FACT_SEPARATOR,
  numpadBoundsHint,
  numpadDigits,
  numpadEntryLabel,
  NumpadKeypad,
  NumpadReadout,
  PresetButton,
  Sheet,
  space,
  type NumpadEntry,
} from '@kitbag/core-design';
import {
  BPM_BOUNDS,
  doubledBpm,
  halvedBpm,
  TAPS_TO_SET_TEMPO,
  useTempoLadder,
} from '@kitbag/core-state';
import { View } from 'react-native';

import { tapsLeftHint } from '../logic/tapPad.ts';
import { NO_TEMPO_NUMERAL, shownBpm } from '../logic/tempoLine.ts';
import { TapLeds } from './TapPad.tsx';
import { useTempoEntry } from './useTempoEntry.ts';

const TITLE = 'Tempo';
const UNIT = 'BPM';

const useStyles = createThemedStyles(() => ({
  presets: { flexDirection: 'row', gap: space.controlGap },
}));

interface TapReadoutProps {
  readonly bpm: number | null;
  readonly tapsLanded: number;
}

function TapReadout({ bpm, tapsLanded }: TapReadoutProps) {
  const set = tapsLanded >= TAPS_TO_SET_TEMPO && bpm !== null;
  return (
    <NumpadReadout
      digits={set ? shownBpm(bpm) : NO_TEMPO_NUMERAL}
      hint={set ? `${shownBpm(bpm)} ${UNIT}` : tapsLeftHint(tapsLanded)}
    >
      <TapLeds landed={tapsLanded} />
    </NumpadReadout>
  );
}

function TypedReadout({ entry }: { readonly entry: NumpadEntry }) {
  return (
    <NumpadReadout
      digits={numpadDigits(entry)}
      accessibilityLabel={numpadEntryLabel(entry, TITLE, UNIT)}
      hint={numpadBoundsHint(BPM_BOUNDS, UNIT)}
    />
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
  const half = bpm === null ? '' : shownBpm(halvedBpm(bpm));
  const twice = bpm === null ? '' : shownBpm(doubledBpm(bpm));
  return (
    <View style={styles.presets}>
      {bpm === null ? null : (
        <>
          <PresetButton
            label={`÷2${FACT_SEPARATOR}${half}`}
            accessibilityLabel={`Half time, ${half} ${UNIT}`}
            onPress={onHalve}
          />
          <PresetButton
            label={`×2${FACT_SEPARATOR}${twice}`}
            accessibilityLabel={`Double time, ${twice} ${UNIT}`}
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
  const { wasBpm } = tempo;
  return (
    <Sheet
      visible={visible}
      title={TITLE}
      titleDetail={
        wasBpm === null ? undefined : `was ${shownBpm(wasBpm)} ${sourceWords}`
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
