import {
  Button,
  createThemedStyles,
  Icon,
  numpadDigits,
  NumpadKeypad,
  NumpadReadout,
  PresetButton,
  SegmentedControl,
  space,
  TapLeds,
  TapPad,
  tapsLeftText,
  useTheme,
  type SegmentOption,
} from '@kitbag/core-design';
import { TAPS_TO_SET_TEMPO } from '@kitbag/core-state';
import { View } from 'react-native';

import { doubleOf, halfOf, typedValue } from '../logic/manualTempoDraft.ts';
import {
  doubleLabel,
  doubleSpoken,
  halfLabel,
  halfSpoken,
  manualBpmText,
  SET_TEMPO_TEXT,
  tappedHint,
  typedHint,
} from '../logic/manualTempoText.ts';
import type { SongPlayhead } from './playhead.ts';
import { SheetTransport } from './SheetTransport.tsx';
import type { SetTempo } from './useSetTempo.ts';
import { ENTRY_MODE, type EntryMode } from './useSetTempoEntry.ts';

const MODE_OPTIONS: readonly SegmentOption<EntryMode>[] = [
  { value: ENTRY_MODE.type, label: SET_TEMPO_TEXT.type },
  { value: ENTRY_MODE.tap, label: SET_TEMPO_TEXT.tap },
];

const useStyles = createThemedStyles(() => ({
  row: { flexDirection: 'row', gap: space.controlGap },
}));

interface StepProps {
  readonly tempo: SetTempo;
}

function TypeEntry({ tempo }: StepProps) {
  const styles = useStyles();
  const { entry, seed, onTyped } = tempo;
  const { shown } = entry;
  const seeded = entry.entry.untouched && seed.bpm !== null;
  const hint = typedHint(seeded ? shown : typedValue(entry.entry));
  return (
    <>
      <NumpadReadout
        digits={
          seeded && shown !== undefined
            ? manualBpmText(shown)
            : numpadDigits(entry.entry)
        }
        hint={hint.text}
        hintTone={hint.tone}
      />
      {shown === undefined ? null : (
        <View style={styles.row}>
          <PresetButton
            label={halfLabel(halfOf(shown))}
            accessibilityLabel={halfSpoken(halfOf(shown))}
            onPress={entry.onHalve}
          />
          <PresetButton
            label={doubleLabel(doubleOf(shown))}
            accessibilityLabel={doubleSpoken(doubleOf(shown))}
            onPress={entry.onDouble}
          />
        </View>
      )}
      <NumpadKeypad
        size="large"
        onDigit={entry.onDigit}
        onBackspace={entry.onBackspace}
        onConfirm={onTyped}
        backspaceLabel={SET_TEMPO_TEXT.backspace}
        confirmLabel={SET_TEMPO_TEXT.next}
      />
    </>
  );
}

function TapEntry({ tempo, playhead }: StepProps & PlayheadProps) {
  const styles = useStyles();
  const theme = useTheme();
  const { taps, tappedBpm, onTap, onStartOver } = tempo.entry;
  const landed = Math.min(taps.length, TAPS_TO_SET_TEMPO);
  return (
    <>
      <NumpadReadout
        digits={
          tappedBpm === null ? SET_TEMPO_TEXT.noTempo : manualBpmText(tappedBpm)
        }
        hint={
          tappedBpm === null
            ? tapsLeftText(taps.length, TAPS_TO_SET_TEMPO)
            : tappedHint(taps.length)
        }
      />
      <SheetTransport playhead={playhead} />
      <TapPad
        title={SET_TEMPO_TEXT.tapTitle}
        hint={SET_TEMPO_TEXT.tapHint}
        onTap={onTap}
      >
        <Icon name="tapAlong" size="retimePad" color={theme.accentInk} />
      </TapPad>
      <TapLeds landed={landed} total={TAPS_TO_SET_TEMPO} />
      <View style={styles.row}>
        <Button
          label={SET_TEMPO_TEXT.startOver}
          icon="reset"
          size="target"
          fill
          disabled={taps.length === 0}
          disabledLook="faded"
          onPress={onStartOver}
        />
        <Button
          label={SET_TEMPO_TEXT.next}
          variant="primary"
          size="target"
          fill
          disabled={tappedBpm === null}
          disabledLook="faded"
          onPress={tempo.onTapped}
        />
      </View>
    </>
  );
}

interface PlayheadProps {
  readonly playhead: SongPlayhead;
}

export function SetTempoStepOne({
  tempo,
  playhead,
}: StepProps & PlayheadProps) {
  const { mode, setMode } = tempo.entry;
  return (
    <>
      <SegmentedControl
        options={MODE_OPTIONS}
        selected={mode}
        onSelect={setMode}
        accessibilityLabel={SET_TEMPO_TEXT.how}
        size="large"
      />
      {mode === ENTRY_MODE.type ? (
        <TypeEntry tempo={tempo} />
      ) : (
        <TapEntry tempo={tempo} playhead={playhead} />
      )}
    </>
  );
}
