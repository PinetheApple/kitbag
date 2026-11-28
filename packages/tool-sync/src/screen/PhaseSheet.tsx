import {
  asPercent,
  Button,
  createThemedStyles,
  DrawnFigures,
  Icon,
  SectionHeader,
  SegmentedControl,
  NumpadReadout,
  Sheet,
  size,
  Stepper,
  sliderGeometry,
  space,
  textRoles,
  textStyle,
  type IconName,
} from '@kitbag/core-design';
import { phaseLimitMs, type PlayAlongLock } from '@kitbag/core-state';
import { useCallback } from 'react';
import { Text, View } from 'react-native';

import {
  beatShareHint,
  downbeatLabel,
  heardSpeed,
  phaseRangeEnds,
  phaseReading,
  phaseStepFromOption,
  PHASE_STEP_OPTIONS,
  phaseThumbFraction,
  phaseTotal,
  routeLine,
} from '../logic/phaseView.ts';
import { useFollowedSession, usePlayAlong } from './playAlongHooks.ts';
import { DOWNBEAT_KEYS, NUDGE_KEYS } from './phaseKeys.ts';
import { useStepHandlers } from './useStepHandlers.ts';

const TITLE = 'Phase';
const THUMB = sliderGeometry.level.thumb;
const TRACK = sliderGeometry.level.track;

export const DOWNBEAT_UNAVAILABLE =
  'Downbeat shift is not available for this beat grid';

export interface PlayAlongRoute {
  readonly icon: IconName;
  readonly label: string;
}

const useStyles = createThemedStyles((theme) => ({
  group: { gap: space.controlGap },
  start: { alignItems: 'flex-start' },
  route: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.controlGap,
  },
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
  prompt: { ...textStyle(textRoles.fieldLabel), color: theme.color.text },
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
  const nudge = useStepHandlers(usePlayAlong((s) => s.nudgePhase));
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
      <View style={styles.start}>
        <Stepper tone="on" value={reading} keys={NUDGE_KEYS} {...nudge} />
      </View>
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

interface DownbeatGroupProps {
  readonly lock: PlayAlongLock;
  readonly onDismiss: () => void;
}

function DownbeatGroup({ lock, onDismiss }: DownbeatGroupProps) {
  const styles = useStyles();
  const shift = useStepHandlers(usePlayAlong((s) => s.shiftDownbeat));
  const askForOne = usePlayAlong((s) => s.askForOne);
  const available = lock.downbeatShiftAvailable;
  const tapTheOne = useCallback(() => {
    askForOne();
    onDismiss();
  }, [askForOne, onDismiss]);
  return (
    <View style={styles.group}>
      <SectionHeader label="Downbeat" />
      <Text style={styles.prompt}>
        Accent on the wrong beat? Tap on the 1, or step it.
      </Text>
      <View style={styles.inline}>
        <Button
          variant="ghost"
          size="prompt"
          icon="tapAlong"
          label="Tap the 1"
          accessibilityLabel="Tap once on the 1"
          disabled={!available}
          disabledLook="faded"
          onPress={tapTheOne}
        />
        <Stepper
          value={downbeatLabel(lock.downbeatShift)}
          keys={DOWNBEAT_KEYS}
          disabled={!available}
          disabledHint={DOWNBEAT_UNAVAILABLE}
          {...shift}
        />
      </View>
    </View>
  );
}

interface OffsetGroupProps {
  readonly phaseOffsetMs: number;
  readonly route: PlayAlongRoute | undefined;
}

function RouteLine({
  route,
  routeMs,
}: {
  readonly route: PlayAlongRoute;
  readonly routeMs: number;
}) {
  const styles = useStyles();
  return (
    <View style={styles.route}>
      <Icon name={route.icon} size="action" color="text2" />
      <Text style={styles.parts}>{routeLine(route.label, routeMs)}</Text>
    </View>
  );
}

function OffsetGroup({ phaseOffsetMs, route }: OffsetGroupProps) {
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
      {route === undefined ? null : (
        <RouteLine route={route} routeMs={routeMs} />
      )}
    </View>
  );
}

function PhaseReadout({ lock }: { readonly lock: PlayAlongLock }) {
  const denominator = usePlayAlong((s) => s.pattern.denominator);
  const speed = heardSpeed(useFollowedSession());
  const limitMs = phaseLimitMs(lock.bpm, denominator, speed);
  const reading = phaseReading(lock.phaseOffsetMs);
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

function ResetNote() {
  const styles = useStyles();
  return (
    <Text style={styles.parts}>
      Reset puts the nudge to 0 and beat 1 back where your taps put it. The lock
      and the tempo stay.
    </Text>
  );
}

export interface PhaseSheetProps {
  readonly visible: boolean;
  readonly route: PlayAlongRoute | undefined;
  readonly bottomInset: number;
  readonly onDismiss: () => void;
}

export function PhaseSheet({
  visible,
  route,
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
          <DownbeatGroup lock={lock} onDismiss={onDismiss} />
          <OffsetGroup phaseOffsetMs={lock.phaseOffsetMs} route={route} />
          <ResetNote />
        </>
      )}
    </Sheet>
  );
}
