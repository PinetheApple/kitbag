import {
  Button,
  createThemedStyles,
  Icon,
  radius,
  Sheet,
  SheetHint,
  size,
  space,
  textRoles,
  textStyle,
  hitSlopFor,
  minTouchTargetDp,
} from '@kitbag/core-design';
import {
  tuningFromCustom,
  type CustomTuning,
  type TunerTuning,
} from '@kitbag/core-state';
import { useCallback, useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import { noteName } from '../logic/notes.ts';
import {
  BUILT_IN_TUNINGS,
  instrumentLabel,
  sameTuning,
} from '../logic/tunings.ts';

const ROW_HIT_SLOP = hitSlopFor(textRoles.rowTitle.size, space.controlGap);

const useStyles = createThemedStyles((theme) => ({
  section: {
    gap: space.controlGap,
  },
  heading: {
    ...textStyle(textRoles.tempoCaption),
    color: theme.color.text3,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.rowGap,
    minHeight: minTouchTargetDp,
    paddingHorizontal: space.cardPadding,
    borderRadius: radius.button,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface2,
  },
  rowSelected: {
    borderColor: theme.color.accentDim,
    backgroundColor: theme.activeControlFill,
  },
  rowText: {
    flex: 1,
  },
  title: {
    ...textStyle(textRoles.rowTitle),
    color: theme.color.text,
  },
  subtitle: {
    ...textStyle(textRoles.rowSubtitle),
    color: theme.color.text2,
  },
}));

interface TuningRowProps {
  readonly tuning: TunerTuning;
  readonly selected: boolean;
  readonly onSelect: (tuning: TunerTuning) => void;
}

function TuningRow({ tuning, selected, onSelect }: TuningRowProps) {
  const styles = useStyles();
  const notes = tuning.notes.map(noteName).join(' ');
  const handlePress = useCallback(() => {
    onSelect(tuning);
  }, [onSelect, tuning]);
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={`${tuning.name}, ${notes}`}
      hitSlop={ROW_HIT_SLOP}
      style={[styles.row, selected && styles.rowSelected]}
      onPress={handlePress}
    >
      <View style={styles.rowText}>
        <Text style={styles.title}>{tuning.name}</Text>
        <Text style={styles.subtitle}>{notes}</Text>
      </View>
      {selected ? <Icon name="check" size="control" color="accent" /> : null}
    </Pressable>
  );
}

interface CustomRowProps {
  readonly row: CustomTuning;
  readonly selected: boolean;
  readonly onSelect: (tuning: TunerTuning) => void;
  readonly onEdit: (row: CustomTuning) => void;
}

function CustomRow({ row, selected, onSelect, onEdit }: CustomRowProps) {
  const styles = useStyles();
  const tuning = useMemo(() => tuningFromCustom(row), [row]);
  const handleEdit = useCallback(() => {
    onEdit(row);
  }, [onEdit, row]);
  return (
    <View style={styles.section}>
      <TuningRow tuning={tuning} selected={selected} onSelect={onSelect} />
      <Button
        label="Edit"
        variant="ghost"
        accessibilityLabel={`Edit ${row.name}`}
        onPress={handleEdit}
      />
    </View>
  );
}

export interface TuningSheetProps {
  readonly visible: boolean;
  readonly current: TunerTuning | null;
  readonly customTunings: readonly CustomTuning[];
  readonly loadFailed: boolean;
  readonly bottomInset: number;
  readonly onShow: () => void;
  readonly onSelect: (tuning: TunerTuning) => void;
  readonly onEdit: (row: CustomTuning) => void;
  readonly onNew: () => void;
  readonly onDismiss: () => void;
}

export function TuningSheet({
  visible,
  current,
  customTunings,
  loadFailed,
  bottomInset,
  onShow,
  onSelect,
  onEdit,
  onNew,
  onDismiss,
}: TuningSheetProps) {
  const styles = useStyles();

  const groups = useMemo(() => {
    const byInstrument = new Map<number, TunerTuning[]>();
    for (const tuning of BUILT_IN_TUNINGS) {
      const list = byInstrument.get(tuning.instrument) ?? [];
      list.push(tuning);
      byInstrument.set(tuning.instrument, list);
    }
    return [...byInstrument.entries()];
  }, []);

  const isCurrent = (tuning: TunerTuning) =>
    current !== null && sameTuning(current, tuning);

  return (
    <Sheet
      visible={visible}
      title="Tuning"
      dismissLabel="Close tuning list"
      bottomInset={bottomInset}
      onShow={onShow}
      onDismiss={onDismiss}
    >
      {groups.map(([instrument, tunings]) => (
        <View key={instrument} style={styles.section}>
          <Text accessibilityRole="header" style={styles.heading}>
            {instrumentLabel(instrument).toUpperCase()}
          </Text>
          {tunings.map((tuning) => (
            <TuningRow
              key={tuning.name}
              tuning={tuning}
              selected={isCurrent(tuning)}
              onSelect={onSelect}
            />
          ))}
        </View>
      ))}
      <View style={styles.section}>
        <Text accessibilityRole="header" style={styles.heading}>
          CUSTOM
        </Text>
        {customTunings.map((row) => (
          <CustomRow
            key={row.id}
            row={row}
            selected={isCurrent(tuningFromCustom(row))}
            onSelect={onSelect}
            onEdit={onEdit}
          />
        ))}
        {loadFailed ? (
          <SheetHint>Couldn&apos;t load your saved tunings.</SheetHint>
        ) : null}
        <Button label="New tuning" variant="tonal" onPress={onNew} />
      </View>
    </Sheet>
  );
}
