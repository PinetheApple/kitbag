import {
  AppBar,
  asPercent,
  Badge,
  Button,
  calibration,
  calibrationText,
  createThemedStyles,
  inset,
  radius,
  size,
  space,
  textRoles,
  textStyle,
} from '@kitbag/core-design';
import { CALIBRATION, routeTitle, useCalibration } from '@kitbag/core-state';
import { useCallback, useMemo } from 'react';
import {
  Pressable,
  Text,
  View,
  type GestureResponderEvent,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { CalibrationScatter } from './CalibrationScatter.tsx';
import { RouteRow } from './RouteRow.tsx';
import { CALIBRATE_LATENCY } from './settingsLabels.ts';
import {
  calibrationView,
  routeMeta,
  type CalibrationResultView,
} from './calibrationView.ts';
import { useCalibrationSession } from './useCalibrationSession.ts';

const TAP_PROMPT = 'TAP ON EVERY CLICK';
const TAP_CAPTION = `OF ${String(CALIBRATION.taps)} TAPS`;
const RESULT_LEAD = 'Your taps land';
const START_OVER = 'Start over';
const USE = 'Use';

const useStyles = createThemedStyles((theme) => ({
  screen: {
    flex: 1,
    backgroundColor: theme.color.bg,
    paddingHorizontal: space.screenInset,
  },
  body: { flex: 1, gap: space.sectionGap },
  tapZone: {
    borderRadius: radius.tempoZone,
    paddingVertical: calibration.tapZoneV,
    alignItems: 'center',
  },
  count: {
    ...textStyle(calibrationText.tapCount),
    lineHeight: calibrationText.tapCount.size,
    includeFontPadding: false,
    color: theme.color.text,
  },
  caption: {
    ...textStyle(calibrationText.tapCaption),
    color: theme.color.text2,
  },
  track: {
    alignSelf: 'stretch',
    height: size.sweepTrack,
    borderRadius: radius.sweepTrack,
    backgroundColor: theme.color.surface3,
    marginTop: space.sectionGap,
    marginHorizontal: inset.sweepH,
    overflow: 'hidden',
  },
  fill: {
    height: size.sweepTrack,
    borderRadius: radius.sweepTrack,
    backgroundColor: theme.color.accent,
  },
  prompt: {
    ...textStyle(calibrationText.tapPrompt),
    color: theme.color.accent,
    textAlign: 'center',
    backgroundColor: theme.color.surface2,
    borderWidth: size.stroke,
    borderStyle: 'dashed',
    borderColor: theme.color.accentDim,
    borderRadius: radius.tempoZone,
    paddingVertical: calibration.tapPromptV,
    paddingHorizontal: calibration.tapPromptH,
  },
  result: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.controlGap,
    paddingHorizontal: inset.editRowH,
  },
  resultText: {
    ...textStyle(textRoles.fieldLabel),
    color: theme.color.text2,
    flexShrink: 1,
  },
  spacer: { flex: 1 },
  actions: { flexDirection: 'row', gap: space.controlGap },
  footnote: {
    ...textStyle(textRoles.fieldLabel),
    color: theme.color.text3,
    textAlign: 'center',
  },
}));

function TapZone({ count, progress }: { count: number; progress: number }) {
  const styles = useStyles();
  const fillWidth = useMemo(() => ({ width: asPercent(progress) }), [progress]);
  return (
    <View style={styles.tapZone}>
      <Text style={styles.count}>{count}</Text>
      <Text style={styles.caption}>{TAP_CAPTION}</Text>
      <View style={styles.track}>
        <View style={[styles.fill, fillWidth]} />
      </View>
    </View>
  );
}

function ResultRow({ result }: { readonly result: CalibrationResultView }) {
  const styles = useStyles();
  if (result.kind === 'message') {
    return (
      <View style={styles.result} accessibilityLiveRegion="polite">
        <Text style={styles.resultText}>{result.text}</Text>
      </View>
    );
  }
  return (
    <View style={styles.result} accessibilityLiveRegion="polite">
      <Text style={styles.resultText}>{RESULT_LEAD}</Text>
      <Badge tone="accent" label={result.badge} />
    </View>
  );
}

export interface CalibrationScreenProps {
  readonly onBack: () => void;
}

export function CalibrationScreen({ onBack }: CalibrationScreenProps) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const session = useCalibrationSession();
  const phase = useCalibration(session, (s) => s.phase);
  const route = useCalibration(session, (s) => s.route);
  const deviations = useCalibration(session, (s) => s.deviations);
  const outcome = useCalibration(session, (s) => s.outcome);
  const notice = useCalibration(session, (s) => s.notice);
  const view = useMemo(
    () => calibrationView({ phase, route, deviations, outcome, notice }),
    [phase, route, deviations, outcome, notice],
  );
  const frame = useMemo(
    () => ({
      paddingTop: space.screenInset + insets.top,
      paddingBottom: space.screenInset + insets.bottom,
    }),
    [insets.top, insets.bottom],
  );

  const handleTap = useCallback(
    (event: GestureResponderEvent) => {
      session.getState().tap(event.nativeEvent.timestamp);
    },
    [session],
  );
  const handleStartOver = useCallback(() => {
    session.getState().startOver();
  }, [session]);
  const handleUse = useCallback(() => {
    session
      .getState()
      .use()
      .then(
        (saved) => {
          if (saved) onBack();
        },
        (error: unknown) => {
          console.warn('[kitbag] could not save the calibration', error);
        },
      );
  }, [session, onBack]);

  const useLabel =
    view.result?.kind === 'measured' ? view.result.useLabel : USE;

  return (
    <View style={[styles.screen, frame]}>
      <AppBar title={CALIBRATE_LATENCY} onBack={onBack} />
      <Pressable
        style={styles.body}
        onPressIn={handleTap}
        accessibilityRole="button"
        accessibilityLabel={TAP_PROMPT}
      >
        {route === null ? null : (
          <RouteRow
            kind={route.kind}
            title={routeTitle(route)}
            meta={routeMeta(route)}
            active
          />
        )}
        <TapZone count={view.count} progress={view.progress} />
        <Text style={styles.prompt}>{TAP_PROMPT}</Text>
        <CalibrationScatter
          dots={view.dots}
          meanX={view.meanX}
          axisMs={view.axisMs}
        />
        {view.result === null ? null : <ResultRow result={view.result} />}
        <View style={styles.spacer} />
        <View style={styles.actions}>
          <Button
            label={START_OVER}
            variant="ghost"
            fill
            onPress={handleStartOver}
          />
          {!view.showUse ? null : (
            <Button
              label={useLabel}
              variant="primary"
              fill
              disabled={!view.canUse}
              onPress={handleUse}
            />
          )}
        </View>
        {route === null ? null : (
          <Text style={styles.footnote}>
            {`Saved for ${routeTitle(route)} only`}
          </Text>
        )}
      </Pressable>
    </View>
  );
}
