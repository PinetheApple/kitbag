import { useCallback, useMemo } from 'react';
import { Text, View } from 'react-native';
import { useDerivedValue } from 'react-native-reanimated';

import { BeatStrip } from '../components/BeatStrip.tsx';
import { Button } from '../components/Button.tsx';
import { Chip } from '../components/Chip.tsx';
import { LiveText } from '../components/LiveText.tsx';
import { PresetButton } from '../components/PresetButton.tsx';
import {
  SegmentedControl,
  type SegmentOption,
} from '../components/SegmentedControl.tsx';
import { Stepper, type StepperKeys } from '../components/Stepper.tsx';
import { manualTempo } from '../manualTempoRoles.ts';
import {
  barOneLabel,
  meterCopy,
  meterLabel,
  playheadValue,
} from '../meterText.ts';
import { space, textRoles } from '../roles.ts';
import { stemPlayer } from '../stemPlayerRoles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { beatsFromBarOne, NUDGE_MS, type TempoDraft } from './draft.ts';
import {
  SetTempoTransport,
  type SetTempoPlayhead,
  type SetTempoTransportProps,
} from './SetTempoTransport.tsx';
import { SET_TEMPO_COPY } from './text.ts';
import type { SetTempo } from './useSetTempo.ts';

const BACK = -1;
const FORWARD = 1;

const useStyles = createThemedStyles((theme) => ({
  row: { flexDirection: 'row', gap: space.controlGap },
  barOne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: stemPlayer.menuRowGap,
    minHeight: stemPlayer.menuRowMinHeight,
  },
  barOneText: { flex: 1, minWidth: 0 },
  barOneValue: {
    ...textStyle({ ...textRoles.rowTitle, tabular: true }),
    color: theme.color.text,
  },
  detail: { ...textStyle(textRoles.rowSubtitle), color: theme.color.text2 },
  hint: {
    ...textStyle(textRoles.rowSubtitle),
    flex: 1,
    minWidth: 0,
    color: theme.color.text2,
  },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.controlGap,
    minHeight: manualTempo.fieldRowMinHeight,
  },
  fieldLabel: {
    ...textStyle(textRoles.sectionLabel),
    flex: 1,
    color: theme.color.text2,
  },
  meter: { gap: space.controlGap },
  meterLabel: {
    ...textStyle(textRoles.sectionLabel),
    color: theme.color.text2,
  },
}));

export interface PreviewClickProps {
  readonly on: boolean;
  readonly onToggle: () => void;
}

interface StepProps<M extends number> {
  readonly tempo: SetTempo<M>;
  readonly draft: TempoDraft<M>;
  readonly playhead: SetTempoPlayhead;
}

interface BarOneProps<M extends number> extends StepProps<M> {
  readonly clickOn: boolean;
}

function BarOneDetail<M extends number>({
  tempo,
  draft,
  playhead,
  clickOn,
}: BarOneProps<M>) {
  const styles = useStyles();
  const live = useDerivedValue(
    () => `${playheadValue(playhead.songSec.value)}.`,
  );
  if (draft.nudgedMs !== 0)
    return (
      <Text style={styles.detail}>
        {tempo.kit.text.nudgedText(draft.nudgedMs, clickOn)}
      </Text>
    );
  return (
    <>
      <LiveText text={live} role="rowSubtitle" color="text2" align="left" />
      <Text style={styles.detail}>{SET_TEMPO_COPY.barOneHelp}</Text>
    </>
  );
}

function BarOneRow<M extends number>(props: BarOneProps<M>) {
  const styles = useStyles();
  return (
    <View style={styles.barOne}>
      <View style={styles.barOneText}>
        <Text style={styles.barOneValue}>
          {barOneLabel(props.draft.anchor)}
        </Text>
        <BarOneDetail {...props} />
      </View>
      <Button
        label={meterCopy.barOneHere}
        size="target"
        onPress={props.tempo.onBarOneHere}
      />
    </View>
  );
}

interface MoveKeyProps {
  readonly amount: number;
  readonly label: string;
  readonly spoken: string;
  readonly onMove: (amount: number) => void;
  readonly icon?: 'earlier' | 'later';
}

function MoveKey({ amount, label, spoken, onMove, icon }: MoveKeyProps) {
  const onPress = useCallback(() => {
    onMove(amount);
  }, [onMove, amount]);
  return (
    <PresetButton
      label={label}
      accessibilityLabel={spoken}
      onPress={onPress}
      {...(icon === undefined
        ? {}
        : { icon, iconAt: icon === 'earlier' ? 'start' : 'end' })}
    />
  );
}

function BarOneMoves<M extends number>({ tempo }: Pick<StepProps<M>, 'tempo'>) {
  const styles = useStyles();
  const { onBeat, onNudge } = tempo;
  const { text } = tempo.kit;
  return (
    <View style={styles.row}>
      <MoveKey
        amount={BACK}
        icon="earlier"
        label={SET_TEMPO_COPY.beat}
        spoken={SET_TEMPO_COPY.beatEarlier}
        onMove={onBeat}
      />
      <MoveKey
        amount={-NUDGE_MS}
        label={text.nudgeLabel(-NUDGE_MS)}
        spoken={text.nudgeSpoken(-NUDGE_MS)}
        onMove={onNudge}
      />
      <MoveKey
        amount={NUDGE_MS}
        label={text.nudgeLabel(NUDGE_MS)}
        spoken={text.nudgeSpoken(NUDGE_MS)}
        onMove={onNudge}
      />
      <MoveKey
        amount={FORWARD}
        icon="later"
        label={SET_TEMPO_COPY.beat}
        spoken={SET_TEMPO_COPY.beatLater}
        onMove={onBeat}
      />
    </View>
  );
}

function TempoFields<M extends number>({
  tempo,
  draft,
}: Omit<StepProps<M>, 'playhead'>) {
  const styles = useStyles();
  const { onStep, onMeter } = tempo;
  const { rules, text } = tempo.kit;
  const keys = useMemo<StepperKeys>(
    () => ({
      earlier: 'decrease',
      later: 'increase',
      earlierLabel: text.slower,
      laterLabel: text.faster,
    }),
    [text],
  );
  const meters = useMemo<readonly SegmentOption<string>[]>(
    () =>
      rules.meters.map((meter) => ({
        value: String(meter),
        label: meterLabel(meter),
      })),
    [rules],
  );
  const slower = useCallback(() => {
    onStep(BACK);
  }, [onStep]);
  const faster = useCallback(() => {
    onStep(FORWARD);
  }, [onStep]);
  const pickMeter = useCallback(
    (value: string) => {
      const meter = Number(value);
      if (rules.isMeter(meter)) onMeter(meter);
    },
    [rules, onMeter],
  );
  return (
    <>
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{SET_TEMPO_COPY.tempo}</Text>
        <Stepper
          value={text.manualBpmText(draft.bpm)}
          keys={keys}
          onEarlier={slower}
          onLater={faster}
        />
      </View>
      <View style={styles.meter}>
        <Text style={styles.meterLabel}>{SET_TEMPO_COPY.beatsPerBar}</Text>
        <SegmentedControl
          options={meters}
          selected={String(draft.beatsPerBar)}
          onSelect={pickMeter}
          accessibilityLabel={SET_TEMPO_COPY.beatsPerBar}
          size="picker"
        />
      </View>
    </>
  );
}

function PreviewClick({ on, onToggle }: PreviewClickProps) {
  const styles = useStyles();
  return (
    <View style={styles.field}>
      <Chip
        label={SET_TEMPO_COPY.previewClick}
        icon="metronome"
        active={on}
        onPress={onToggle}
      />
      <Text style={styles.hint}>{SET_TEMPO_COPY.previewHint}</Text>
    </View>
  );
}

export interface SetTempoStepTwoProps<M extends number> extends StepProps<M> {
  readonly transport: SetTempoTransportProps;
  readonly previewClick: PreviewClickProps;
}

export function SetTempoStepTwo<M extends number>({
  tempo,
  draft,
  playhead,
  transport,
  previewClick,
}: SetTempoStepTwoProps<M>) {
  const styles = useStyles();
  const { anchor, bpm } = draft;
  const { secondsPerMinute } = tempo.kit.rules;
  const beats = useDerivedValue(() =>
    beatsFromBarOne(playhead.songSec.value, { anchor, bpm }, secondsPerMinute),
  );
  return (
    <>
      <BeatStrip
        beatsPerBar={draft.beatsPerBar}
        beatsFromBarOne={beats}
        label={barOneLabel(anchor)}
      />
      <SetTempoTransport playhead={playhead} {...transport} />
      <BarOneRow
        tempo={tempo}
        draft={draft}
        playhead={playhead}
        clickOn={previewClick.on}
      />
      <BarOneMoves tempo={tempo} />
      <TempoFields tempo={tempo} draft={draft} />
      <PreviewClick {...previewClick} />
      <View style={styles.row}>
        <Button
          label={SET_TEMPO_COPY.back}
          size="target"
          fill
          onPress={tempo.onBack}
        />
        <Button
          label={SET_TEMPO_COPY.save}
          variant="primary"
          size="target"
          fill
          onPress={tempo.onSave}
        />
      </View>
    </>
  );
}
