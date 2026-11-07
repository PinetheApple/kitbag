import {
  Icon,
  IconGlyph,
  iconSizes,
  isTextScaled,
  LiveSlot,
  LiveText,
  useReduceMotionValue,
  useTheme,
} from '@kitbag/core-design';
import { KB_COUNT_IN_BARS } from '@kitbag/core-native';
import { BPM_BOUNDS, type RampConfig } from '@kitbag/core-state';
import { useMemo } from 'react';
import { Text, useWindowDimensions, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated';

import {
  statusProgressReserve,
  statusStackHeight,
  statusTextLines,
} from '../logic/belowTempo.ts';
import { rampProgressFill, rampTrackShown } from '../logic/rampProgress.ts';
import {
  afterCountInSummary,
  armedSummary,
  countInBarText,
  rampNextText,
  rampRemainingText,
  spokenArmedSummary,
  statusRows,
  type PracticeSettings,
  type StatusRows,
} from '../logic/statusRows.ts';
import { trackOpacity } from '../logic/trackOpacity.ts';
import { MuteStatus } from './MuteStatus.tsx';
import { countInInk, useStatusStyles } from './statusStyles.ts';
import { StatusVariant } from './StatusVariant.tsx';
import type { MetronomeFrameValues } from './useMetronomeFrame.ts';
import { useStatusRowFrame } from './useStatusRowFrame.ts';

export type StatusFrame = Pick<
  MetronomeFrameValues,
  | 'countingIn'
  | 'countInBar'
  | 'countInBarsTotal'
  | 'barMuted'
  | 'barMutePosition'
  | 'rampState'
  | 'rampNextBpm'
  | 'rampRemaining'
  | 'rampStepProgress'
>;

const RAMP_NEXT_WIDEST = rampNextText(BPM_BOUNDS.max);
const LONGEST_COUNT_IN = Math.max(...KB_COUNT_IN_BARS);
const COUNT_IN_WIDEST = countInBarText(LONGEST_COUNT_IN - 1, LONGEST_COUNT_IN);

interface RampStatusProps {
  readonly rows: SharedValue<StatusRows>;
  readonly frame: StatusFrame;
  readonly ramp: RampConfig;
}

function useProgressReserve(): { readonly paddingBottom: number } {
  const { fontScale } = useWindowDimensions();
  return useMemo(
    () => ({ paddingBottom: statusProgressReserve(fontScale) }),
    [fontScale],
  );
}

function RampStatus({ rows, frame, ramp }: RampStatusProps) {
  const styles = useStatusStyles();
  const scaled = isTextScaled(useWindowDimensions().fontScale);
  const reserve = useProgressReserve();
  const { rampNextBpm, rampRemaining, rampStepProgress } = frame;
  const { unit, interval } = ramp;
  const still = useReduceMotionValue();
  const next = useDerivedValue(() => rampNextText(rampNextBpm.value));
  const remaining = useDerivedValue(() =>
    rampRemainingText(rampRemaining.value, unit),
  );
  const progress = useAnimatedStyle(() => ({
    transform: [
      {
        scaleX: rampProgressFill(
          rampStepProgress.value,
          rampRemaining.value,
          interval,
          unit,
          still.value,
        ),
      },
    ],
  }));
  const track = useAnimatedStyle(() => ({
    opacity: trackOpacity(rampTrackShown(interval, unit, still.value)),
  }));
  return (
    <StatusVariant rows={rows} shown="ramp" style={[styles.live, reserve]}>
      <Icon name="ramp" size="statusLive" color="text2" />
      <LiveSlot
        text={next}
        role="statusLead"
        widest={RAMP_NEXT_WIDEST}
        textStyle={styles.lead}
      />
      <LiveText
        text={remaining}
        role="status"
        align="left"
        style={styles.detail}
      />
      <Text style={[styles.meta, scaled && styles.ownLine]}>
        {`target ${String(ramp.targetBpm)}`}
      </Text>
      <Animated.View style={[styles.progressTrack, track]}>
        <Animated.View style={[styles.progress, progress]} />
      </Animated.View>
    </StatusVariant>
  );
}

function ReachedStatus({
  rows,
  targetBpm,
}: {
  readonly rows: SharedValue<StatusRows>;
  readonly targetBpm: number;
}) {
  const styles = useStatusStyles();
  const reserve = useProgressReserve();
  return (
    <StatusVariant
      rows={rows}
      shown="reached"
      style={[styles.live, styles.reached, reserve]}
    >
      <Icon name="check" size="statusLive" color="accentDeep" />
      <Text style={styles.lead}>{`Ramp reached ${String(targetBpm)}`}</Text>
      <Text style={[styles.meta, styles.pushRight]}>holding</Text>
      <View style={[styles.progressTrack, styles.progress]} />
    </StatusVariant>
  );
}

function CountInStatus({
  rows,
  countInBar,
  countInBarsTotal,
}: {
  readonly rows: SharedValue<StatusRows>;
  readonly countInBar: SharedValue<number>;
  readonly countInBarsTotal: SharedValue<number>;
}) {
  const styles = useStatusStyles();
  const theme = useTheme();
  const meta = useDerivedValue(() =>
    countInBarText(countInBar.value, countInBarsTotal.value),
  );
  return (
    <StatusVariant
      rows={rows}
      shown="countIn"
      style={[styles.live, styles.countIn]}
    >
      <IconGlyph
        name="countingIn"
        px={iconSizes.statusLive}
        color={countInInk(theme.color.bg, theme.color.text)}
      />
      <Text style={[styles.lead, styles.countInLead]}>Count-in</Text>
      <LiveSlot
        text={meta}
        role="statusMeta"
        widest={COUNT_IN_WIDEST}
        textStyle={[styles.meta, styles.countInMeta]}
        style={styles.pushRight}
      />
    </StatusVariant>
  );
}

function AfterCountInStatus({
  rows,
  summary,
}: {
  readonly rows: SharedValue<StatusRows>;
  readonly summary: string;
}) {
  const styles = useStatusStyles();
  const { fontScale } = useWindowDimensions();
  const lines = statusTextLines(fontScale);
  return (
    <StatusVariant
      rows={rows}
      shown="afterCountIn"
      style={[styles.live, styles.afterCountIn]}
      wrapsWhenScaled={false}
    >
      <Icon name="practiceTools" size="statusLive" color="text2" />
      <Text style={[styles.lead, styles.afterCountInText]}>Then</Text>
      <Text
        style={[
          styles.meta,
          styles.pushRight,
          isTextScaled(fontScale) && styles.shrink,
        ]}
        numberOfLines={lines}
      >
        {summary}
      </Text>
    </StatusVariant>
  );
}

interface StatusStackProps {
  readonly frame: StatusFrame;
  readonly settings: PracticeSettings;
  readonly running: boolean;
}

export function StatusStack({ frame, settings, running }: StatusStackProps) {
  const styles = useStatusStyles();
  const { fontScale } = useWindowDimensions();
  const { countingIn, barMutePosition, rampState } = frame;
  const afterCountIn = afterCountInSummary(settings);
  const hasAfterCountIn = afterCountIn !== '';
  const rows = useDerivedValue(() =>
    statusRows(
      {
        countingIn: countingIn.value,
        barMutePosition: barMutePosition.value,
        rampState: rampState.value,
      },
      hasAfterCountIn,
    ),
  );
  const summary = armedSummary(settings);
  const stack = useMemo(
    () => ({ height: statusStackHeight(running, fontScale) }),
    [running, fontScale],
  );
  const restRow = useStatusRowFrame();
  return (
    <View
      style={stack}
      accessible
      accessibilityRole="text"
      accessibilityLabel={spokenArmedSummary(settings)}
      pointerEvents="none"
    >
      {running ? null : (
        <View style={[styles.rest, restRow]}>
          <Icon name="practiceTools" size="statusRest" color="text2" />
          <Text
            style={styles.restText}
            numberOfLines={statusTextLines(fontScale)}
          >
            {summary}
          </Text>
        </View>
      )}
      <MuteStatus
        rows={rows}
        barMuted={frame.barMuted}
        barMutePosition={frame.barMutePosition}
        barMute={settings.barMute}
      />
      <RampStatus rows={rows} frame={frame} ramp={settings.ramp} />
      <ReachedStatus rows={rows} targetBpm={settings.ramp.targetBpm} />
      <CountInStatus
        rows={rows}
        countInBar={frame.countInBar}
        countInBarsTotal={frame.countInBarsTotal}
      />
      <AfterCountInStatus rows={rows} summary={afterCountIn} />
    </View>
  );
}
