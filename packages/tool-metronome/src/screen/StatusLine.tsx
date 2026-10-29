import {
  Icon,
  IconGlyph,
  iconSizes,
  LiveText,
  useTheme,
} from '@kitbag/core-design';
import { KB_COUNT_IN_BARS } from '@kitbag/core-native';
import { BPM_BOUNDS, type RampConfig } from '@kitbag/core-state';
import { Text, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useDerivedValue,
  type SharedValue,
} from 'react-native-reanimated';

import {
  armedSummary,
  countInBarText,
  rampNextText,
  rampRemainingText,
  statusMode,
  type PracticeSettings,
  type StatusMode,
} from '../logic/statusLine.ts';
import { LiveSlot } from './LiveSlot.tsx';
import { MuteStatus } from './MuteStatus.tsx';
import { countInInk, useStatusStyles } from './statusStyles.ts';
import { StatusVariant } from './StatusVariant.tsx';
import type { MetronomeFrameValues } from './useMetronomeFrame.ts';

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
  readonly mode: SharedValue<StatusMode>;
  readonly frame: StatusFrame;
  readonly ramp: RampConfig;
}

function RampStatus({ mode, frame, ramp }: RampStatusProps) {
  const styles = useStatusStyles();
  const { rampNextBpm, rampRemaining, rampStepProgress } = frame;
  const unit = ramp.unit;
  const next = useDerivedValue(() => rampNextText(rampNextBpm.value));
  const remaining = useDerivedValue(() =>
    rampRemainingText(rampRemaining.value, unit),
  );
  const progress = useAnimatedStyle(() => ({
    transform: [{ scaleX: Math.min(1, Math.max(0, rampStepProgress.value)) }],
  }));
  return (
    <StatusVariant mode={mode} shown="ramp" style={styles.live}>
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
      <Text style={styles.meta}>{`target ${String(ramp.targetBpm)}`}</Text>
      <View style={styles.progressTrack}>
        <Animated.View style={[styles.progress, progress]} />
      </View>
    </StatusVariant>
  );
}

function ReachedStatus({
  mode,
  targetBpm,
}: {
  readonly mode: SharedValue<StatusMode>;
  readonly targetBpm: number;
}) {
  const styles = useStatusStyles();
  return (
    <StatusVariant
      mode={mode}
      shown="reached"
      style={[styles.live, styles.reached]}
    >
      <Icon name="check" size="statusLive" color="accentDeep" />
      <Text style={styles.lead}>{`Ramp reached ${String(targetBpm)}`}</Text>
      <Text style={[styles.meta, styles.pushRight]}>holding</Text>
      <View style={[styles.progressTrack, styles.progress]} />
    </StatusVariant>
  );
}

function CountInStatus({
  mode,
  countInBar,
  countInBarsTotal,
}: {
  readonly mode: SharedValue<StatusMode>;
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
      mode={mode}
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

interface StatusLineProps {
  readonly frame: StatusFrame;
  readonly settings: PracticeSettings;
}

export function StatusLine({ frame, settings }: StatusLineProps) {
  const styles = useStatusStyles();
  const { countingIn, barMuted, barMutePosition, rampState } = frame;
  const mode = useDerivedValue(() =>
    statusMode({
      countingIn: countingIn.value,
      barMuted: barMuted.value,
      barMutePosition: barMutePosition.value,
      rampState: rampState.value,
    }),
  );
  const summary = armedSummary(settings);
  return (
    <View
      style={styles.line}
      accessible
      accessibilityRole="text"
      accessibilityLabel={summary}
      pointerEvents="none"
    >
      <StatusVariant mode={mode} shown="rest" style={styles.rest}>
        <Icon name="practiceTools" size="statusRest" color="text2" />
        <Text style={styles.restText} numberOfLines={1}>
          {summary}
        </Text>
      </StatusVariant>
      <RampStatus mode={mode} frame={frame} ramp={settings.ramp} />
      <ReachedStatus mode={mode} targetBpm={settings.ramp.targetBpm} />
      <MuteStatus
        mode={mode}
        barMuted={frame.barMuted}
        barMutePosition={frame.barMutePosition}
        barMute={settings.barMute}
      />
      <CountInStatus
        mode={mode}
        countInBar={frame.countInBar}
        countInBarsTotal={frame.countInBarsTotal}
      />
    </View>
  );
}
