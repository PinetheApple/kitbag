import {
  Badge,
  Button,
  Card,
  createThemedStyles,
  DRIFT_STRIP_STOPS,
  DrawnFigures,
  opacity,
  rowLineHeight,
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
  type DriftStateInputs,
  type DriftView,
} from '../logic/driftMeter.ts';
import { useLastSeen } from './useLastSeen.ts';
import { useWholeSecondNow } from './useWholeSecondNow.ts';

const NEEDLE_SHOWN = 1;

const useStyles = createThemedStyles((theme) => ({
  stack: { gap: space.sectionGap },
  head: { gap: space.controlGap },
  top: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.controlGap,
  },
  status: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
  },
  inline: { flex: 1, minWidth: 0 },
  spacer: { flex: 1 },
  statusText: {
    ...textStyle(textRoles.rowSubtitle),
    lineHeight: rowLineHeight.subtitle,
    color: theme.color.text2,
  },
  muted: { opacity: opacity.muted },
  foot: { flexDirection: 'row', justifyContent: 'flex-end' },
}));

function StatusLine({ view, inline }: { view: DriftView; inline: boolean }) {
  const styles = useStyles();
  return (
    <View style={[styles.status, inline && styles.inline]}>
      <Text style={styles.statusText}>{view.lead}</Text>
      {view.figures === null ? null : (
        <DrawnFigures text={view.figures} role="rowSubtitle" color="text2" />
      )}
      {view.tail === '' ? null : (
        <Text style={styles.statusText}>{view.tail}</Text>
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
        {ownLine ? (
          <View style={styles.spacer} />
        ) : (
          <StatusLine view={view} inline />
        )}
        <DrawnFigures
          text={view.reading}
          role="factChip"
          color={drifting ? 'amberInk' : 'text'}
        />
      </View>
      {ownLine ? <StatusLine view={view} inline={false} /> : null}
    </View>
  );
}

function RetapFoot({ view, onRetap }: DriftMeterCardProps) {
  const styles = useStyles();
  if (!view.controls) return null;
  return (
    <View style={styles.foot}>
      <Button
        variant="tonal"
        size="prompt"
        icon="tapAlong"
        iconSize="control"
        label="Re-tap"
        accessibilityLabel="Re-tap on a downbeat"
        disabled={!view.retapEnabled}
        disabledLook="faded"
        onPress={onRetap}
      />
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
    <Card {...(drifting ? { borderTone: 'warning' as const } : {})}>
      <View style={styles.stack}>
        <MeterHead view={view} />
        <View style={view.muted ? styles.muted : null}>
          <TunerStrip
            needle={needle}
            active={shown}
            stops={DRIFT_STRIP_STOPS}
            needleColor={drifting ? 'amber' : 'text'}
          />
        </View>
        <RetapFoot view={view} onRetap={onRetap} />
      </View>
    </Card>
  );
}

export interface DriftMeterProps {
  readonly lock: PlayAlongLock;
  readonly session: MediaSessionSnapshot | undefined;
  readonly drift: DriftStateInputs;
  readonly onRetap: () => void;
}

export function DriftMeter({ lock, session, drift, onRetap }: DriftMeterProps) {
  const appLabel = useLastSeen(session?.appLabel);
  const nowMs = useWholeSecondNow(
    drift.sourceGoneAtMs ?? lock.lockedAtBoottimeMs,
  );
  const view = driftMeterView({
    ...drift,
    lockedAtMs: lock.lockedAtBoottimeMs,
    appLabel,
    nowMs,
  });
  return <DriftMeterCard view={view} onRetap={onRetap} />;
}
