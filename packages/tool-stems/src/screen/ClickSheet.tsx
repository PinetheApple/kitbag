import {
  ClickBeatLegend,
  ClickBeatStrip,
  Button,
  createThemedStyles,
  GroupKeys,
  GroupTiles,
  PickerGrid,
  SectionHeader,
  SegmentedControl,
  Sheet,
  space,
  textRoles,
  textStyle,
  type PickerOption,
  type SegmentOption,
} from '@kitbag/core-design';
import {
  CLICK_RATE,
  impliedMeter,
  groupBeats,
  useStemPlayer,
  type ClickRate,
} from '@kitbag/core-state';
import { useCallback, useMemo, useRef, useState, type RefObject } from 'react';
import { Text, View } from 'react-native';

import {
  barCounts,
  builderHint,
  canAddGroup,
  canGrowGroups,
  CLICK_SECTION,
  clickBeats,
  clickCopy,
  type ClickSection,
  CUSTOM_GROUP_SIZES,
  CUSTOM_PICK,
  groupingLabel,
  groupingPick,
  groupingPresets,
  mismatchNote,
  OFF_PICK,
  RATE_HINT,
  RATE_ORDER,
  rateLabel,
  stripBarBeats,
} from '../logic/clickView.ts';

const useStyles = createThemedStyles((theme) => ({
  group: { gap: space.controlGap },
  hint: { ...textStyle(textRoles.sheetHint), color: theme.color.text2 },
  foot: { flexDirection: 'row', gap: space.controlGap },
}));

interface StripProps {
  readonly groups: readonly number[];
  readonly barBeats: number;
  readonly rate: ClickRate;
}

function Strip({ groups, barBeats, rate }: StripProps) {
  return (
    <ClickBeatStrip
      groups={clickBeats(groups, barBeats, rate)}
      halfBeats={rate === CLICK_RATE.double}
    />
  );
}

function useSongBars() {
  const downbeats = useStemPlayer((s) => s.downbeatIndices);
  return useMemo(
    () => ({ counts: barCounts(downbeats), common: impliedMeter(downbeats) }),
    [downbeats],
  );
}

interface BuilderProps {
  readonly groups: readonly number[];
  readonly onChange: (groups: readonly number[]) => void;
}

function useGroupEdits(
  groups: readonly number[],
  onChange: (groups: readonly number[]) => void,
) {
  const canAdd = useCallback(
    (beats: number) => canAddGroup(groups, beats),
    [groups],
  );
  const add = useCallback(
    (beats: number) => {
      onChange([...groups, beats]);
    },
    [groups, onChange],
  );
  const remove = useCallback(() => {
    onChange(groups.slice(0, -1));
  }, [groups, onChange]);
  return { canAdd, add, remove };
}

function CustomBuilder({ groups, onChange }: BuilderProps) {
  const styles = useStyles();
  const { counts, common } = useSongBars();
  const { canAdd, add, remove } = useGroupEdits(groups, onChange);
  return (
    <View style={styles.group}>
      <GroupTiles
        groups={groups}
        beats={groupBeats(groups)}
        barBeats={common}
        open={canGrowGroups(groups)}
      />
      <GroupKeys
        sizes={CUSTOM_GROUP_SIZES}
        canAdd={canAdd}
        canRemove={groups.length > 0}
        onAdd={add}
        onRemove={remove}
      />
      <Text style={styles.hint}>{builderHint(groups, counts, common)}</Text>
    </View>
  );
}

function Mismatch({ groups, rate }: Omit<StripProps, 'barBeats'>) {
  const styles = useStyles();
  const { counts } = useSongBars();
  const note = mismatchNote(groups, counts);
  if (note === null) return null;
  return (
    <View style={styles.group}>
      <Text style={styles.hint}>{note.text}</Text>
      <Strip groups={[]} barBeats={note.barBeats} rate={rate} />
    </View>
  );
}

function usePicks(common: number) {
  return useMemo(() => {
    const presets = groupingPresets(common);
    const options: PickerOption<string>[] = [
      { value: OFF_PICK, label: clickCopy.off },
      ...presets.map((p) => ({
        value: groupingLabel(p),
        label: groupingLabel(p),
      })),
      { value: CUSTOM_PICK, label: clickCopy.custom },
    ];
    return { presets, options };
  }, [common]);
}

function usePickGrouping(
  presets: readonly (readonly number[])[],
  onCustom: (open: boolean) => void,
) {
  const setGrouping = useStemPlayer((s) => s.setClickGrouping);
  return useCallback(
    (value: string) => {
      onCustom(value === CUSTOM_PICK);
      if (value === CUSTOM_PICK) return;
      if (value === OFF_PICK) {
        void setGrouping([]);
        return;
      }
      const preset = presets.find((p) => groupingLabel(p) === value);
      if (preset !== undefined) void setGrouping(preset);
    },
    [onCustom, presets, setGrouping],
  );
}

function GroupingPicker({ customOpen, onCustom }: CustomState) {
  const styles = useStyles();
  const groups = useStemPlayer((s) => s.clickGrouping);
  const { common } = useSongBars();
  const { presets, options } = usePicks(common);
  const pick = usePickGrouping(presets, onCustom);
  const picked = groupingPick(groups, presets, customOpen);
  return (
    <View style={styles.group}>
      <PickerGrid
        options={options}
        selected={picked}
        accessibilityLabel={clickCopy.groupingRow}
        onSelect={pick}
      />
      {picked === OFF_PICK ? (
        <Text style={styles.hint}>{clickCopy.offHint}</Text>
      ) : null}
    </View>
  );
}

interface CustomState {
  readonly customOpen: boolean;
  readonly onCustom: (open: boolean) => void;
}

function GroupingStrip({ groups, rate }: Omit<StripProps, 'barBeats'>) {
  const styles = useStyles();
  const { counts, common } = useSongBars();
  const barBeats = stripBarBeats(groups, counts, common);
  return (
    <View style={styles.group}>
      <SectionHeader
        label={`${clickCopy.grouping} · ${String(barBeats)}-beat bars`}
      />
      <Strip groups={groups} barBeats={barBeats} rate={rate} />
      <ClickBeatLegend
        silent={rate === CLICK_RATE.half}
        halfBeats={rate === CLICK_RATE.double}
      />
    </View>
  );
}

function GroupingSection({ customOpen, onCustom }: CustomState) {
  const groups = useStemPlayer((s) => s.clickGrouping);
  const rate = useStemPlayer((s) => s.clickRate);
  const setGrouping = useStemPlayer((s) => s.setClickGrouping);
  const edit = useCallback(
    (next: readonly number[]) => {
      void setGrouping(next);
    },
    [setGrouping],
  );
  return (
    <>
      <GroupingStrip groups={groups} rate={rate} />
      <GroupingPicker customOpen={customOpen} onCustom={onCustom} />
      {customOpen ? (
        <CustomBuilder groups={groups} onChange={edit} />
      ) : (
        <Mismatch groups={groups} rate={rate} />
      )}
    </>
  );
}

type HeadingRef = RefObject<View | null>;

function RateHeading({ headingRef }: { readonly headingRef: HeadingRef }) {
  return (
    <View
      ref={headingRef}
      accessible
      accessibilityRole="header"
      accessibilityLabel={clickCopy.rate}
    >
      <SectionHeader label={clickCopy.rate} />
    </View>
  );
}

function RateSection({ headingRef }: { readonly headingRef: HeadingRef }) {
  const styles = useStyles();
  const rate = useStemPlayer((s) => s.clickRate);
  const setRate = useStemPlayer((s) => s.setClickRate);
  const pickRate = useCallback(
    (picked: ClickRate) => {
      void setRate(picked);
    },
    [setRate],
  );
  const options = useMemo<readonly SegmentOption<ClickRate>[]>(
    () => RATE_ORDER.map((value) => ({ value, label: rateLabel(value) })),
    [],
  );
  return (
    <View style={styles.group}>
      <RateHeading headingRef={headingRef} />
      <SegmentedControl
        size="large"
        options={options}
        selected={rate}
        accessibilityLabel={clickCopy.rateRow}
        onSelect={pickRate}
      />
      <Text style={styles.hint}>{RATE_HINT[rate]}</Text>
    </View>
  );
}

export interface ClickSheetProps {
  readonly visible: boolean;
  readonly section: ClickSection;
  readonly bottomInset: number;
  readonly onClose: () => void;
}

export function ClickSheet({
  visible,
  section,
  bottomInset,
  onClose,
}: ClickSheetProps) {
  const styles = useStyles();
  const rateHeading = useRef<View>(null);
  const [customOpen, setCustomOpen] = useState(false);
  const close = useCallback(() => {
    setCustomOpen(false);
    onClose();
  }, [onClose]);
  return (
    <Sheet
      visible={visible}
      title={clickCopy.title}
      dismissLabel={clickCopy.close}
      bottomInset={bottomInset}
      {...(section === CLICK_SECTION.rate
        ? { initialFocusRef: rateHeading }
        : {})}
      onDismiss={close}
    >
      <GroupingSection customOpen={customOpen} onCustom={setCustomOpen} />
      <RateSection headingRef={rateHeading} />
      <View style={styles.foot}>
        <Button label={clickCopy.done} size="sheet" fill onPress={close} />
      </View>
    </Sheet>
  );
}
