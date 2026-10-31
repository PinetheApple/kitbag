import {
  Chip,
  createThemedStyles,
  EDIT_ROW_PRESSABLE_GAP,
  EditGroup,
  EditRow,
  EditValue,
  inset,
  SectionHeader,
  StepControl,
  textRoles,
  textStyle,
  type StepDelta,
} from '@kitbag/core-design';
import {
  formatOffsetMs,
  useMetronome,
  useRigClick,
  useRouteLatency,
  useSubdivisionAccents,
} from '@kitbag/core-state';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import { AccentLeds } from './AccentLeds.tsx';
import { AccentsSheet } from './AccentsSheet.tsx';
import { OutputSheet, RouteSheet, useRouteRows } from './OutputSheets.tsx';
import { routeLatency } from './rigRuntime';
import { outputName, outputStatus, rigChip, rigClickHint } from './rigText.ts';
import { CALIBRATE_LATENCY } from './settingsLabels.ts';
import { useRigClickSession } from './useRigClickSession.ts';
import { VolumeRow } from './VolumeRow.tsx';

const LATENCY_LABEL = 'Latency offset';
const OUTPUT_LABEL = 'Output';
const ACCENTS_LABEL = 'Subdivision accents';
const STEP_GAPS = {
  top: EDIT_ROW_PRESSABLE_GAP,
  bottom: EDIT_ROW_PRESSABLE_GAP,
};

type RigSheet =
  | { readonly kind: 'none' | 'output' | 'accents' }
  | { readonly kind: 'route'; readonly route: string };

const NO_SHEET: RigSheet = { kind: 'none' };
const OUTPUT_SHEET: RigSheet = { kind: 'output' };
const ACCENTS_SHEET: RigSheet = { kind: 'accents' };

const useStyles = createThemedStyles((theme) => ({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: inset.chipFillH,
    paddingRight: inset.sectionLabelH,
  },
  hint: {
    ...textStyle(textRoles.hint),
    color: theme.color.text3,
    paddingHorizontal: inset.sectionLabelH,
  },
  chipRow: { flexDirection: 'row', paddingHorizontal: inset.sectionLabelH },
}));

function LatencyRow() {
  const offset = useMetronome((s) => s.latencyOffset);
  const step = useCallback((delta: StepDelta) => {
    routeLatency.getState().step(delta);
  }, []);
  return (
    <EditRow label={LATENCY_LABEL}>
      <StepControl
        label={LATENCY_LABEL}
        value={formatOffsetMs(offset)}
        onStep={step}
        variant="inline"
        wide
        repeat
        neighbourGapDp={STEP_GAPS}
      />
    </EditRow>
  );
}

function OutputRow({ onPress }: { readonly onPress: () => void }) {
  const live = useRouteLatency(routeLatency, (s) => s.live);
  const calibrated = useRouteLatency(
    routeLatency,
    (s) => s.live !== null && s.stored[s.live.id] !== undefined,
  );
  const name = live === null ? null : outputName(live);
  const status = outputStatus(calibrated);
  return (
    <EditRow
      label={OUTPUT_LABEL}
      accessibilityLabel={[OUTPUT_LABEL, name, status]
        .filter((part) => part !== null)
        .join(', ')}
      onPress={onPress}
    >
      {name === null ? null : (
        <EditValue>
          {`${name} `}
          <EditValue muted>{status}</EditValue>
        </EditValue>
      )}
    </EditRow>
  );
}

function AccentsRow({ onPress }: { readonly onPress: () => void }) {
  const count = useSubdivisionAccents((s) => s.lastCount);
  const mask = useSubdivisionAccents((s) => s.masks[s.lastCount] ?? 0);
  return (
    <EditRow label={ACCENTS_LABEL} onPress={onPress}>
      <AccentLeds mask={mask} count={count} size="small" />
    </EditRow>
  );
}

export function RigSection({
  onOpenCalibration,
}: {
  readonly onOpenCalibration: () => void;
}) {
  const styles = useStyles();
  const click = useRigClickSession();
  const phase = useRigClick(click, (s) => s.phase);
  const running = useMetronome((s) => s.running);
  const [sheet, setSheet] = useState<RigSheet>(NO_SHEET);
  const rows = useRouteRows();
  const chip = rigChip(phase);
  const hint = rigClickHint(phase, running);

  useEffect(() => {
    if (running) click.getState().stop();
  }, [running, click]);

  const handlers = useMemo(
    () => ({
      toggleClick: () => {
        void click.getState().toggle();
      },
      hear: (count: number) => {
        void click.getState().play(count);
      },
      openOutput: () => {
        setSheet(OUTPUT_SHEET);
      },
      openAccents: () => {
        setSheet(ACCENTS_SHEET);
      },
      selectRoute: (route: string) => {
        setSheet({ kind: 'route', route });
      },
      close: () => {
        setSheet(NO_SHEET);
      },
      calibrate: () => {
        setSheet(NO_SHEET);
        onOpenCalibration();
      },
    }),
    [click, onOpenCalibration],
  );
  const selected =
    sheet.kind === 'route'
      ? (rows.find((row) => row.route.id === sheet.route) ?? null)
      : null;

  return (
    <>
      <View style={styles.header}>
        <SectionHeader label="Rig" />
        <Chip
          label={chip.label}
          icon={chip.icon}
          active={chip.icon === 'stop'}
          disabled={running}
          onPress={handlers.toggleClick}
        />
      </View>
      {hint === null ? null : (
        <Text style={styles.hint} accessibilityLiveRegion="polite">
          {hint}
        </Text>
      )}
      <EditGroup>
        <VolumeRow />
        <LatencyRow />
        <OutputRow onPress={handlers.openOutput} />
        <AccentsRow onPress={handlers.openAccents} />
      </EditGroup>
      <View style={styles.chipRow}>
        <Chip
          label={CALIBRATE_LATENCY}
          icon="calibrate"
          onPress={onOpenCalibration}
        />
      </View>
      <OutputSheet
        visible={sheet.kind === 'output'}
        rows={rows}
        onSelect={handlers.selectRoute}
        onDismiss={handlers.close}
      />
      <RouteSheet
        row={selected}
        onCalibrate={handlers.calibrate}
        onCleared={handlers.openOutput}
        onDismiss={handlers.openOutput}
      />
      <AccentsSheet
        visible={sheet.kind === 'accents'}
        canHear={!running}
        onHear={handlers.hear}
        onDismiss={handlers.close}
      />
    </>
  );
}
