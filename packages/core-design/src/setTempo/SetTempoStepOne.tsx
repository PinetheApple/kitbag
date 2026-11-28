import { View } from 'react-native';

import { Button } from '../components/Button.tsx';
import { Icon } from '../components/Icon.tsx';
import { NumpadKeypad } from '../components/NumpadKeypad.tsx';
import { NumpadReadout } from '../components/NumpadReadout.tsx';
import { PresetButton } from '../components/PresetButton.tsx';
import {
  SegmentedControl,
  type SegmentOption,
} from '../components/SegmentedControl.tsx';
import { TapLeds, TapPad } from '../components/TapPad.tsx';
import { numpadDigits } from '../numpadEntry.ts';
import { space } from '../roles.ts';
import { tapsLeftText } from '../tapText.ts';
import { createThemedStyles, useTheme } from '../ThemeProvider.tsx';
import { doubleOf, halfOf } from './draft.ts';
import {
  SetTempoTransport,
  type SetTempoPlayhead,
  type SetTempoTransportProps,
} from './SetTempoTransport.tsx';
import { SET_TEMPO_COPY } from './text.ts';
import type { SetTempo } from './useSetTempo.ts';
import { ENTRY_MODE, type EntryMode } from './useSetTempoEntry.ts';

const MODE_OPTIONS: readonly SegmentOption<EntryMode>[] = [
  { value: ENTRY_MODE.type, label: SET_TEMPO_COPY.type },
  { value: ENTRY_MODE.tap, label: SET_TEMPO_COPY.tap },
];

const useStyles = createThemedStyles(() => ({
  row: { flexDirection: 'row', gap: space.controlGap },
}));

interface StepProps<M extends number> {
  readonly tempo: SetTempo<M>;
}

interface TransportProps {
  readonly playhead: SetTempoPlayhead;
  readonly transport: SetTempoTransportProps;
}

function TypeEntry<M extends number>({ tempo }: StepProps<M>) {
  const styles = useStyles();
  const { entry, seed, onTyped } = tempo;
  const { text } = tempo.kit;
  const { shown } = entry;
  const seeded = entry.numpad.untouched && seed.bpm !== null;
  const hint = text.typedHint(shown);
  return (
    <>
      <NumpadReadout
        digits={
          seeded && shown !== undefined
            ? text.manualBpmText(shown)
            : numpadDigits(entry.numpad)
        }
        hint={hint.text}
        hintTone={hint.tone}
      />
      {shown === undefined ? null : (
        <View style={styles.row}>
          <PresetButton
            label={text.halfLabel(halfOf(shown))}
            accessibilityLabel={text.halfSpoken(halfOf(shown))}
            onPress={entry.onHalve}
          />
          <PresetButton
            label={text.doubleLabel(doubleOf(shown))}
            accessibilityLabel={text.doubleSpoken(doubleOf(shown))}
            onPress={entry.onDouble}
          />
        </View>
      )}
      <NumpadKeypad
        size="large"
        onDigit={entry.onDigit}
        onBackspace={entry.onBackspace}
        onConfirm={onTyped}
        backspaceLabel={SET_TEMPO_COPY.backspace}
        confirmLabel={SET_TEMPO_COPY.next}
      />
    </>
  );
}

function TapFoot<M extends number>({ tempo }: StepProps<M>) {
  const styles = useStyles();
  const { taps, tappedBpm, onStartOver } = tempo.entry;
  return (
    <View style={styles.row}>
      <Button
        label={SET_TEMPO_COPY.startOver}
        icon="reset"
        size="target"
        fill
        disabled={taps.length === 0}
        disabledLook="faded"
        onPress={onStartOver}
      />
      <Button
        label={SET_TEMPO_COPY.next}
        variant="primary"
        size="target"
        fill
        disabled={tappedBpm === null}
        disabledLook="faded"
        onPress={tempo.onTapped}
      />
    </View>
  );
}

function TapEntry<M extends number>({
  tempo,
  playhead,
  transport,
}: StepProps<M> & TransportProps) {
  const theme = useTheme();
  const { taps, tappedBpm, onTap } = tempo.entry;
  const { rules, text } = tempo.kit;
  const landed = Math.min(taps.length, rules.tapsToSet);
  return (
    <>
      <NumpadReadout
        digits={
          tappedBpm === null
            ? SET_TEMPO_COPY.noTempo
            : text.manualBpmText(tappedBpm)
        }
        hint={
          tappedBpm === null
            ? tapsLeftText(taps.length, rules.tapsToSet)
            : text.tappedHint(taps.length)
        }
      />
      <SetTempoTransport playhead={playhead} {...transport} />
      <TapPad
        title={SET_TEMPO_COPY.tapTitle}
        hint={SET_TEMPO_COPY.tapHint}
        onTap={onTap}
      >
        <Icon name="tapAlong" size="retimePad" color={theme.accentInk} />
      </TapPad>
      <TapLeds landed={landed} total={rules.tapsToSet} />
      <TapFoot tempo={tempo} />
    </>
  );
}

export function SetTempoStepOne<M extends number>({
  tempo,
  playhead,
  transport,
}: StepProps<M> & TransportProps) {
  const { mode, setMode } = tempo.entry;
  return (
    <>
      <SegmentedControl
        options={MODE_OPTIONS}
        selected={mode}
        onSelect={setMode}
        accessibilityLabel={SET_TEMPO_COPY.how}
        size="large"
      />
      {mode === ENTRY_MODE.type ? (
        <TypeEntry tempo={tempo} />
      ) : (
        <TapEntry tempo={tempo} playhead={playhead} transport={transport} />
      )}
    </>
  );
}
