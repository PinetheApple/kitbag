import {
  barOneLabel,
  BeatStrip,
  Button,
  createThemedStyles,
  LiveText,
  manualTempo,
  meterCopy,
  meterLabel,
  playheadValue,
  PresetButton,
  SegmentedControl,
  space,
  stemPlayer,
  Stepper,
  textRoles,
  textStyle,
  type SegmentOption,
  type StepperKeys,
} from '@kitbag/core-design';
import { GRID_METERS, isGridMeter } from '@kitbag/core-state';
import { useCallback } from 'react';
import { Text, View } from 'react-native';
import { useDerivedValue } from 'react-native-reanimated';

import {
  beatsFromBarOne,
  NUDGE_MS,
  type TempoDraft,
} from '../logic/manualTempoDraft.ts';
import {
  manualBpmText,
  nudgedText,
  nudgeLabel,
  nudgeSpoken,
  SET_TEMPO_TEXT,
} from '../logic/manualTempoText.ts';
import type { SongPlayhead } from './playhead.ts';
import { SheetTransport } from './SheetTransport.tsx';
import type { SetTempo } from './useSetTempo.ts';

const EARLIER = -1;
const LATER = 1;

const TEMPO_KEYS: StepperKeys = {
  earlier: 'decrease',
  later: 'increase',
  earlierLabel: SET_TEMPO_TEXT.slower,
  laterLabel: SET_TEMPO_TEXT.faster,
};

const METER_OPTIONS: readonly SegmentOption<string>[] = GRID_METERS.map(
  (meter) => ({ value: String(meter), label: meterLabel(meter) }),
);

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
}));

interface StepProps {
  readonly tempo: SetTempo;
  readonly draft: TempoDraft;
  readonly playhead: SongPlayhead;
}

function BarOneDetail({ draft, playhead }: Omit<StepProps, 'tempo'>) {
  const styles = useStyles();
  const live = useDerivedValue(() => playheadValue(playhead.songSec.value));
  if (draft.nudgedMs !== 0)
    return <Text style={styles.detail}>{nudgedText(draft.nudgedMs)}</Text>;
  return (
    <>
      <LiveText text={live} role="rowSubtitle" color="text2" align="left" />
      <Text style={styles.detail}>{SET_TEMPO_TEXT.barOneHelp}</Text>
    </>
  );
}

function BarOneRow({ tempo, draft, playhead }: StepProps) {
  const styles = useStyles();
  return (
    <View style={styles.barOne}>
      <View style={styles.barOneText}>
        <Text style={styles.barOneValue}>{barOneLabel(draft.anchor)}</Text>
        <BarOneDetail draft={draft} playhead={playhead} />
      </View>
      <Button
        label={meterCopy.barOneHere}
        size="target"
        onPress={tempo.onBarOneHere}
      />
    </View>
  );
}

function BarOneMoves({ tempo }: Pick<StepProps, 'tempo'>) {
  const styles = useStyles();
  const { onBeat, onNudge } = tempo;
  const earlierBeat = useCallback(() => {
    onBeat(EARLIER);
  }, [onBeat]);
  const laterBeat = useCallback(() => {
    onBeat(LATER);
  }, [onBeat]);
  const earlierNudge = useCallback(() => {
    onNudge(-NUDGE_MS);
  }, [onNudge]);
  const laterNudge = useCallback(() => {
    onNudge(NUDGE_MS);
  }, [onNudge]);
  return (
    <View style={styles.row}>
      <PresetButton
        label={SET_TEMPO_TEXT.beat}
        icon="back"
        accessibilityLabel={SET_TEMPO_TEXT.beatEarlier}
        onPress={earlierBeat}
      />
      <PresetButton
        label={nudgeLabel(-NUDGE_MS)}
        accessibilityLabel={nudgeSpoken(-NUDGE_MS)}
        onPress={earlierNudge}
      />
      <PresetButton
        label={nudgeLabel(NUDGE_MS)}
        accessibilityLabel={nudgeSpoken(NUDGE_MS)}
        onPress={laterNudge}
      />
      <PresetButton
        label={SET_TEMPO_TEXT.beat}
        icon="forward"
        iconAt="end"
        accessibilityLabel={SET_TEMPO_TEXT.beatLater}
        onPress={laterBeat}
      />
    </View>
  );
}

function TempoFields({ tempo, draft }: Omit<StepProps, 'playhead'>) {
  const styles = useStyles();
  const { onStep, onMeter } = tempo;
  const slower = useCallback(() => {
    onStep(EARLIER);
  }, [onStep]);
  const faster = useCallback(() => {
    onStep(LATER);
  }, [onStep]);
  const pickMeter = useCallback(
    (value: string) => {
      const meter = Number(value);
      if (isGridMeter(meter)) onMeter(meter);
    },
    [onMeter],
  );
  return (
    <>
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{SET_TEMPO_TEXT.tempo}</Text>
        <Stepper
          value={manualBpmText(draft.bpm)}
          keys={TEMPO_KEYS}
          onEarlier={slower}
          onLater={faster}
        />
      </View>
      <View style={styles.field}>
        <Text style={styles.fieldLabel}>{SET_TEMPO_TEXT.beatsPerBar}</Text>
        <SegmentedControl
          options={METER_OPTIONS}
          selected={String(draft.beatsPerBar)}
          onSelect={pickMeter}
          accessibilityLabel={SET_TEMPO_TEXT.beatsPerBar}
          size="picker"
        />
      </View>
    </>
  );
}

export function SetTempoStepTwo({ tempo, draft, playhead }: StepProps) {
  const styles = useStyles();
  const { anchor, bpm } = draft;
  const beats = useDerivedValue(() =>
    beatsFromBarOne(playhead.songSec.value, { anchor, bpm }),
  );
  return (
    <>
      <BeatStrip
        beatsPerBar={draft.beatsPerBar}
        beatsFromBarOne={beats}
        label={barOneLabel(anchor)}
      />
      <SheetTransport playhead={playhead} />
      <BarOneRow tempo={tempo} draft={draft} playhead={playhead} />
      <BarOneMoves tempo={tempo} />
      <TempoFields tempo={tempo} draft={draft} />
      <View style={styles.row}>
        <Button
          label={SET_TEMPO_TEXT.back}
          size="target"
          fill
          onPress={tempo.onBack}
        />
        <Button
          label={SET_TEMPO_TEXT.save}
          variant="primary"
          size="target"
          fill
          onPress={tempo.onSave}
        />
      </View>
    </>
  );
}
