import {
  asPercent,
  Button,
  createThemedStyles,
  DrawnFigures,
  SectionHeader,
  SegmentedControl,
  NumpadReadout,
  Sheet,
  size,
  sliderGeometry,
  space,
  textRoles,
  textStyle,
} from '@kitbag/core-design';
import {
  formatOffsetMs,
  phaseLimitMs,
  type PlayAlongLock,
} from '@kitbag/core-state';
import { useCallback } from 'react';
import { Text, View } from 'react-native';

import {
  beatShareHint,
  downbeatLabel,
  heardSpeed,
  phaseRangeEnds,
  phaseStepFromOption,
  PHASE_STEP_OPTIONS,
  phaseThumbFraction,
  phaseTotal,
} from '../logic/phaseView.ts';
import { useFollowedSession, usePlayAlong } from './playAlongHooks.ts';
import { DOWNBEAT_KEYS, NUDGE_KEYS } from './phaseKeys.ts';
import { Stepper } from './Stepper.tsx';

const TITLE = 'Phase';
const THUMB = sliderGeometry.level.thumb;
const TRACK = sliderGeometry.level.track;

export const DOWNBEAT_UNAVAILABLE =
  'Downbeat shift is not available for this beat grid';

const useStyles = createThemedStyles((theme) => ({
  group: { gap: space.controlGap },
  scale: { height: THUMB, marginHorizontal: THUMB / 2 },
  track: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: (THUMB - TRACK) / 2,
    height: TRACK,
    borderRadius: TRACK / 2,
    backgroundColor: theme.color.surface3,
  },
  tick: {
    position: 'absolute',
    left: '50%',
    top: size.stroke,
    bottom: size.stroke,
    width: sliderGeometry.tick,
    marginLeft: -sliderGeometry.tick / 2,
    backgroundColor: theme.color.decor,
  },
  thumb: {
    position: 'absolute',
    top: 0,
    width: THUMB,
    height: THUMB,
    marginLeft: -THUMB / 2,
    borderRadius: THUMB / 2,
    backgroundColor: theme.color.accent,
  },
  ends: { flexDirection: 'row', justifyContent: 'space-between' },
  end: { ...textStyle(textRoles.faderEnd), color: theme.color.text2 },
  inline: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    gap: space.controlGap,
  },
  label: {
    ...textStyle(textRoles.fieldLabel),
    flex: 1,
    minWidth: 0,
    color: theme.color.text,
  },
  total: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'baseline',
    columnGap: space.chipGap,
  },
  parts: { ...textStyle(textRoles.rowSubtitle), color: theme.color.text2 },
}));

interface PhaseRangeProps {
  readonly offsetMs: number;
  readonly limitMs: number;
}

function PhaseRange({ offsetMs, limitMs }: PhaseRangeProps) {
  const styles = useStyles();
  const ends = phaseRangeEnds(limitMs);
  const left = asPercent(phaseThumbFraction(offsetMs, limitMs));
  return (
    <View accessible accessibilityLabel={`Range ${ends.start} to ${ends.end}`}>
      <View style={styles.scale}>
        <View style={styles.track} />
        <View style={styles.tick} />
        <View style={[styles.thumb, { left }]} />
      </View>
      <View style={styles.ends}>
        <Text style={styles.end}>{ends.start}</Text>
        <Text style={styles.end}>{ends.end}</Text>
      </View>
    </View>
  );
}

function NudgeGroup({ reading }: { readonly reading: string }) {
  const styles = useStyles();
  const nudgePhase = usePlayAlong((s) => s.nudgePhase);
  const stepMs = usePlayAlong((s) => s.phaseStepMs);
  const setPhaseStep = usePlayAlong((s) => s.setPhaseStep);
  const handleStep = useCallback(
    (value: string) => {
      const step = phaseStepFromOption(value);
      if (step !== undefined) setPhaseStep(step);
    },
    [setPhaseStep],
  );
  return (
    <View style={styles.group}>
      <SectionHeader label="Nudge" />
      <Stepper
        tone="on"
        value={reading}
        keys={NUDGE_KEYS}
        onStep={nudgePhase}
      />
      <SegmentedControl
        size="large"
        options={PHASE_STEP_OPTIONS}
        selected={String(stepMs)}
        accessibilityLabel="Nudge step size"
        onSelect={handleStep}
      />
    </View>
  );
}

function DownbeatGroup({ lock }: { readonly lock: PlayAlongLock }) {
  const styles = useStyles();
  const shiftDownbeat = usePlayAlong((s) => s.shiftDownbeat);
  const available = lock.downbeatShiftAvailable;
  return (
    <View style={styles.group}>
      <SectionHeader label="Downbeat" />
      <View style={styles.inline}>
        <Text style={styles.label}>
          Tapped on beat 3 by mistake? Shift the bar.
        </Text>
        <Stepper
          value={downbeatLabel(lock.downbeatShift)}
          keys={DOWNBEAT_KEYS}
          disabled={!available}
          {...(available ? {} : { accessibilityLabel: DOWNBEAT_UNAVAILABLE })}
          onStep={shiftDownbeat}
        />
      </View>
    </View>
  );
}

function OffsetGroup({ phaseOffsetMs }: { readonly phaseOffsetMs: number }) {
  const styles = useStyles();
  const routeMs = usePlayAlong((s) => s.latencyOffsetMs);
  const total = phaseTotal(routeMs, phaseOffsetMs);
  return (
    <View style={styles.group}>
      <SectionHeader label="Offset" />
      <View
        accessible
        accessibilityLabel={`${total.total} ${total.parts}`}
        style={styles.total}
      >
        <DrawnFigures text={total.total} role="factChip" />
        <Text style={styles.parts}>{total.parts}</Text>
      </View>
    </View>
  );
}

function PhaseReadout({ lock }: { readonly lock: PlayAlongLock }) {
  const denominator = usePlayAlong((s) => s.pattern.denominator);
  const speed = heardSpeed(useFollowedSession());
  const limitMs = phaseLimitMs(lock.bpm, denominator, speed);
  const reading = formatOffsetMs(lock.phaseOffsetMs);
  return (
    <>
      <NumpadReadout
        digits={reading}
        accessibilityLabel={`Phase ${reading}`}
        hint={beatShareHint(lock.phaseOffsetMs, limitMs, lock.bpm * speed)}
      />
      <PhaseRange offsetMs={lock.phaseOffsetMs} limitMs={limitMs} />
      <NudgeGroup reading={reading} />
    </>
  );
}

function ResetAction() {
  const resetPhase = usePlayAlong((s) => s.resetPhase);
  return (
    <Button
      variant="ghost"
      size="prompt"
      icon="reset"
      label="Reset"
      accessibilityLabel="Reset phase and downbeat"
      onPress={resetPhase}
    />
  );
}

export interface PhaseSheetProps {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly onDismiss: () => void;
}

export function PhaseSheet({
  visible,
  bottomInset,
  onDismiss,
}: PhaseSheetProps) {
  const lock = usePlayAlong((s) => s.lock);
  return (
    <Sheet
      visible={visible && lock !== undefined}
      title={TITLE}
      titleAction={<ResetAction />}
      dismissLabel="Close phase"
      bottomInset={bottomInset}
      onDismiss={onDismiss}
    >
      {lock === undefined ? null : (
        <>
          <PhaseReadout lock={lock} />
          <DownbeatGroup lock={lock} />
          <OffsetGroup phaseOffsetMs={lock.phaseOffsetMs} />
        </>
      )}
    </Sheet>
  );
}
