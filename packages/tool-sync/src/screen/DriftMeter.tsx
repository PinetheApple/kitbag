import {
  Badge,
  Button,
  createThemedStyles,
  DRIFT_STRIP_STOPS,
  DrawnFigures,
  opacity,
  radii,
  rowLineHeight,
  size,
  space,
  textRoles,
  textStyle,
  TunerStrip,
  useTextScaled,
} from '@kitbag/core-design';
import type { MediaSessionSnapshot } from '@kitbag/core-native';
import type { PlayAlongLock } from '@kitbag/core-state';
import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { useSharedValue } from 'react-native-reanimated';

import {
  DRIFT_STATE,
  driftMeterView,
  type DriftView,
} from '../logic/driftMeter.ts';
import { usePlayAlong } from './playAlongHooks.ts';
import { useLastSeen } from './useLastSeen.ts';
import { useWholeSecondNow } from './useWholeSecondNow.ts';

const NEEDLE_SHOWN = 1;

const useStyles = createThemedStyles((theme) => ({
  card: {
    gap: space.sectionGap,
    padding: space.cardPadding,
    borderRadius: radii.card,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface1,
  },
  warning: { borderColor: theme.feedback.warning.cardBorder },
  head: { gap: space.controlGap },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.controlGap,
  },
  when: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  inline: { flex: 1, minWidth: 0 },
  spacer: { flex: 1 },
  whenText: {
    ...textStyle(textRoles.rowSubtitle),
    lineHeight: rowLineHeight.subtitle,
    color: theme.color.text2,
  },
  muted: { opacity: opacity.muted },
  foot: { flexDirection: 'row', justifyContent: 'flex-end' },
}));

function When({ view, inline }: { view: DriftView; inline: boolean }) {
  const styles = useStyles();
  return (
    <View style={[styles.when, inline && styles.inline]}>
      <Text style={styles.whenText}>{view.lead}</Text>
      {view.figures === null ? null : (
        <DrawnFigures text={view.figures} role="rowSubtitle" color="text2" />
      )}
      {view.tail === '' ? null : (
        <Text style={styles.whenText}>{view.tail}</Text>
      )}
    </View>
  );
}

function spoken(view: DriftView): string {
  return `${view.badge.label}, ${view.lead}${view.figures ?? ''}${view.tail}, ${view.reading}`;
}

function MeterHead({ view }: { view: DriftView }) {
  const styles = useStyles();
  const ownLine = useTextScaled();
  const drifting = view.state === DRIFT_STATE.drift;
  return (
    <View accessible accessibilityLabel={spoken(view)} style={styles.head}>
      <View style={styles.top}>
        <Badge label={view.badge.label} tone={view.badge.tone} />
        {ownLine ? <View style={styles.spacer} /> : <When view={view} inline />}
        <DrawnFigures
          text={view.reading}
          role="factChip"
          color={drifting ? 'amberInk' : 'text'}
        />
      </View>
      {ownLine ? <When view={view} inline={false} /> : null}
    </View>
  );
}

export interface DriftMeterCardProps {
  readonly view: DriftView;
  readonly onRetap: () => void;
}

export function DriftMeterCard({ view, onRetap }: DriftMeterCardProps) {
  const styles = useStyles();
  const needle = useSharedValue(view.needle);
  const shown = useSharedValue(NEEDLE_SHOWN);
  const drifting = view.state === DRIFT_STATE.drift;
  useEffect(() => {
    needle.value = view.needle;
  }, [needle, view.needle]);
  return (
    <View style={[styles.card, drifting && styles.warning]}>
      <MeterHead view={view} />
      <View style={view.muted ? styles.muted : null}>
        <TunerStrip
          needle={needle}
          active={shown}
          stops={DRIFT_STRIP_STOPS}
          needleColor={drifting ? 'amber' : 'text'}
        />
      </View>
      {view.controls ? (
        <View style={styles.foot}>
          <Button
            variant="tonal"
            size="prompt"
            icon="tapAlong"
            iconSize="control"
            label="Re-tap"
            accessibilityLabel="Re-tap on a downbeat"
            onPress={onRetap}
          />
        </View>
      ) : null}
    </View>
  );
}

export interface DriftMeterProps {
  readonly lock: PlayAlongLock;
  readonly session: MediaSessionSnapshot | undefined;
  readonly onRetap: () => void;
}

export function DriftMeter({ lock, session, onRetap }: DriftMeterProps) {
  const songAheadOfClickMs = usePlayAlong((s) => s.songAheadOfClickMs);
  const sourceGoneAtMs = usePlayAlong((s) => s.sourceGoneAtBoottimeMs);
  const appLabel = useLastSeen(session?.appLabel);
  const nowMs = useWholeSecondNow(sourceGoneAtMs ?? lock.lockedAtBoottimeMs);
  const view = driftMeterView({
    lockedAtMs: lock.lockedAtBoottimeMs,
    songAheadOfClickMs,
    playing: session?.playing === true,
    sourceGoneAtMs,
    appLabel,
    nowMs,
  });
  return <DriftMeterCard view={view} onRetap={onRetap} />;
}
