import { useCallback, useMemo } from 'react';
import { Text, View } from 'react-native';
import { useDerivedValue, type SharedValue } from 'react-native-reanimated';

import {
  BAR_ONE_YOURS,
  barOneLabel,
  detectedHint,
  isOverridden,
  METER_PENDING,
  meterLabel,
  playheadDetail,
  type MeterChoice,
  type MeterGridState,
} from '../meterText.ts';
import { space, textRoles } from '../roles.ts';
import { stemPlayer } from '../stemPlayerRoles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles } from '../ThemeProvider.tsx';
import { Badge } from './Badge.tsx';
import { Button } from './Button.tsx';
import { LiveText } from './LiveText.tsx';
import { SectionHeader } from './SectionHeader.tsx';
import { SegmentedControl, type SegmentOption } from './SegmentedControl.tsx';
import { Sheet, SheetHint } from './Sheet.tsx';
import { Snackbar } from './Snackbar.tsx';

const useStyles = createThemedStyles((theme) => ({
  group: { gap: space.controlGap },
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
  barOneDetail: {
    ...textStyle(textRoles.rowSubtitle),
    color: theme.color.text2,
  },
  hint: { ...textStyle(textRoles.sheetHint), color: theme.color.text2 },
  foot: { flexDirection: 'row', gap: space.controlGap },
}));

export interface MeterSheetNotice {
  readonly message: string;
  readonly actionLabel: string;
  readonly onAction: () => void;
  readonly onTimeout: () => void;
}

export interface MeterSheetProps {
  readonly visible: boolean;
  readonly options: readonly number[];
  readonly detectedMeter: number;
  readonly detectedBarOneSeconds: number;
  readonly override: MeterChoice;
  readonly playheadSeconds: SharedValue<number>;
  readonly state: MeterGridState;
  readonly failedReason: string;
  readonly notice?: MeterSheetNotice | null;
  readonly bottomInset?: number;
  readonly onPickMeter: (meter: number) => void;
  readonly onBarOneHere: () => void;
  readonly onReset: () => void;
  readonly onClose: () => void;
}

function MeterPicker({
  options: meters,
  detectedMeter,
  detectedBarOneSeconds,
  override,
  onPickMeter,
}: MeterSheetProps) {
  const styles = useStyles();
  const options: readonly SegmentOption<string>[] = useMemo(
    () => meters.map((m) => ({ value: String(m), label: meterLabel(m) })),
    [meters],
  );
  const pick = useCallback(
    (value: string) => {
      const meter = meters.find((m) => String(m) === value);
      if (meter !== undefined) onPickMeter(meter);
    },
    [meters, onPickMeter],
  );
  return (
    <View style={styles.group}>
      <SectionHeader label="Beats per bar" />
      <SegmentedControl
        options={options}
        selected={String(override.meterBeatsPerBar ?? detectedMeter)}
        onSelect={pick}
        accessibilityLabel="Beats per bar"
        size="large"
      />
      <Text style={styles.hint}>
        {detectedHint(
          detectedMeter,
          detectedBarOneSeconds,
          isOverridden(override),
        )}
      </Text>
    </View>
  );
}

function BarOneDetail({
  yours,
  playheadSeconds,
}: {
  readonly yours: boolean;
  readonly playheadSeconds: SharedValue<number>;
}) {
  const styles = useStyles();
  const live = useDerivedValue(() => playheadDetail(playheadSeconds.value));
  if (yours) return <Text style={styles.barOneDetail}>{BAR_ONE_YOURS}</Text>;
  return (
    <LiveText
      text={live}
      role="rowSubtitle"
      color="text2"
      align="left"
      style={styles.barOneDetail}
    />
  );
}

function MeterControls(props: MeterSheetProps) {
  const styles = useStyles();
  const { detectedBarOneSeconds, override, playheadSeconds, onBarOneHere } =
    props;
  const barOneSeconds = override.barOneSeconds ?? detectedBarOneSeconds;
  return (
    <>
      <MeterPicker {...props} />
      <View style={styles.group}>
        <SectionHeader label="Bar 1" />
        <View style={styles.barOne}>
          <View style={styles.barOneText}>
            <Text style={styles.barOneValue}>{barOneLabel(barOneSeconds)}</Text>
            <BarOneDetail
              yours={override.barOneSeconds !== null}
              playheadSeconds={playheadSeconds}
            />
          </View>
          <Button label="Bar 1 here" size="target" onPress={onBarOneHere} />
        </View>
      </View>
    </>
  );
}

function MeterFoot({
  yours,
  onReset,
  onClose,
}: MeterSheetProps & { readonly yours: boolean }) {
  const styles = useStyles();
  return (
    <View style={styles.foot}>
      {yours ? (
        <Button
          label="Use detected"
          icon="reset"
          size="target"
          fill
          onPress={onReset}
        />
      ) : null}
      <Button label="Done" size="target" fill onPress={onClose} />
    </View>
  );
}

function unavailableText(
  state: MeterGridState,
  failedReason: string,
): string | null {
  if (state === 'ready') return null;
  return state === 'pending' ? METER_PENDING : failedReason;
}

export function MeterSheet(props: MeterSheetProps) {
  const { visible, override, state, notice, bottomInset, onClose } = props;
  const unavailable = unavailableText(state, props.failedReason);
  const yours = unavailable === null && isOverridden(override);
  return (
    <Sheet
      visible={visible}
      title="Meter"
      titleAction={yours ? <Badge label="YOURS" icon="edit" /> : undefined}
      dismissLabel="Close the meter sheet"
      {...(bottomInset === undefined ? {} : { bottomInset })}
      notice={notice == null ? undefined : <Snackbar inline {...notice} />}
      onDismiss={onClose}
    >
      {unavailable === null ? (
        <MeterControls {...props} />
      ) : (
        <SheetHint>{unavailable}</SheetHint>
      )}
      <MeterFoot yours={yours} {...props} />
    </Sheet>
  );
}
