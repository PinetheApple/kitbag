import {
  Button,
  createThemedStyles,
  Sheet,
  SheetHint,
  space,
} from '@kitbag/core-design';
import { useMetronome, useRouteLatency } from '@kitbag/core-state';
import { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { routeLatency } from './rigRuntime';
import { routeRows, type RouteRowView } from './rigText.ts';
import { RouteRow } from './RouteRow.tsx';
import { CALIBRATE_LATENCY } from './settingsLabels.ts';

const OUTPUT_TITLE = 'Output & latency';
const OUTPUT_HINT =
  'Kitbag keeps an offset for each output and applies the one in use. Tap an output to calibrate or clear it.';
const CLOSE = 'Close';
const CLEAR = 'Clear';

const useStyles = createThemedStyles(() => ({
  actions: { flexDirection: 'row', gap: space.controlGap },
}));

export function useRouteRows(): RouteRowView[] {
  const live = useRouteLatency(routeLatency, (s) => s.live);
  const stored = useRouteLatency(routeLatency, (s) => s.stored);
  const applied = useMetronome((s) => s.latencyOffset);
  return useMemo(
    () => routeRows(live, stored, applied),
    [live, stored, applied],
  );
}

function OutputRouteRow({
  row,
  onSelect,
}: {
  readonly row: RouteRowView;
  readonly onSelect: (route: string) => void;
}) {
  const select = useCallback(() => {
    onSelect(row.route.id);
  }, [onSelect, row.route.id]);
  return (
    <RouteRow
      kind={row.route.kind}
      title={row.title}
      meta={row.meta}
      offset={row.offset}
      active={row.live}
      onPress={select}
    />
  );
}

export interface OutputSheetProps {
  readonly visible: boolean;
  readonly rows: readonly RouteRowView[];
  readonly onSelect: (route: string) => void;
  readonly onDismiss: () => void;
}

export function OutputSheet({
  visible,
  rows,
  onSelect,
  onDismiss,
}: OutputSheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Sheet
      visible={visible}
      title={OUTPUT_TITLE}
      titleIcon="output"
      dismissLabel={CLOSE}
      bottomInset={insets.bottom}
      onDismiss={onDismiss}
    >
      {rows.map((row) => (
        <OutputRouteRow key={row.route.id} row={row} onSelect={onSelect} />
      ))}
      <SheetHint>{OUTPUT_HINT}</SheetHint>
    </Sheet>
  );
}

export interface RouteSheetProps {
  readonly row: RouteRowView | null;
  readonly onCalibrate: () => void;
  readonly onCleared: () => void;
  readonly onDismiss: () => void;
}

export function RouteSheet({
  row,
  onCalibrate,
  onCleared,
  onDismiss,
}: RouteSheetProps) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const route = row?.route.id;
  const clear = useCallback(() => {
    if (route === undefined) return;
    routeLatency
      .getState()
      .clear(route)
      .catch((error: unknown) => {
        console.warn('[kitbag] could not clear the route latency', error);
      });
    onCleared();
  }, [route, onCleared]);
  const hint =
    row === null || row.live
      ? undefined
      : `Connect ${row.title} to calibrate it.`;
  return (
    <Sheet
      visible={row !== null}
      title={row?.title ?? ''}
      dismissLabel={CLOSE}
      bottomInset={insets.bottom}
      onDismiss={onDismiss}
    >
      {row === null ? null : (
        <RouteRow
          kind={row.route.kind}
          title={row.title}
          meta={row.meta}
          offset={row.offset}
          active={row.live}
        />
      )}
      <View style={styles.actions}>
        <Button
          label={CLEAR}
          variant="ghost"
          fill
          disabled={row?.stored !== true}
          onPress={clear}
        />
        <Button
          label={CALIBRATE_LATENCY}
          icon="calibrate"
          variant="primary"
          fill
          disabled={row?.live !== true}
          onPress={onCalibrate}
        />
      </View>
      {hint === undefined ? null : <SheetHint>{hint}</SheetHint>}
    </Sheet>
  );
}
