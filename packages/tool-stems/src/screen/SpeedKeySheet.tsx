import {
  createThemedStyles,
  minTouchTargetDp,
  Icon,
  PresetButton,
  Sheet,
  size,
  space,
  stemPlayer,
  textRoles,
  textStyle,
  useTextScaled,
} from '@kitbag/core-design';
import { SPEED_PRESETS, speedPercent, useStemPlayer } from '@kitbag/core-state';
import { useCallback, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  keyHint,
  perStemSummary,
  speedHint,
  speedKeyCopy,
  speedText,
} from '../logic/speedKeyView.ts';
import { SongKeyStepper, SpeedStepper } from './SpeedKeyDock.tsx';
import { StemKeyRows } from './StemKeyRows.tsx';

export const PER_STEM_STACKED_ID = 'per-stem-stacked';

const ROW_GAPS = { top: space.sectionGap, bottom: space.sectionGap };

const useStyles = createThemedStyles((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: stemPlayer.menuRowGap,
    minHeight: minTouchTargetDp,
  },
  label: {
    ...textStyle(textRoles.menuRow),
    color: theme.color.text,
    flexGrow: 1,
    flexShrink: 1,
  },
  presets: { flexDirection: 'row', gap: space.controlGap },
  hint: { ...textStyle(textRoles.hint), color: theme.color.text3 },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: stemPlayer.menuRowGap,
    minHeight: stemPlayer.menuRowMinHeight,
    borderTopWidth: size.stroke,
    borderTopColor: theme.color.line,
  },
  value: {
    ...textStyle(textRoles.menuValue),
    color: theme.color.text2,
    flexShrink: 1,
    textAlign: 'right',
  },
  toggleBody: { flexGrow: 1, flexShrink: 1 },
  valueBelow: { ...textStyle(textRoles.menuValue), color: theme.color.text2 },
}));

function SpeedPreset({ speed }: { readonly speed: number }) {
  const current = useStemPlayer((s) => s.speed);
  const setSpeed = useStemPlayer((s) => s.setSpeed);
  const pick = useCallback(() => {
    void setSpeed(speed);
  }, [setSpeed, speed]);
  return (
    <PresetButton
      label={speedText(speed)}
      accessibilityLabel={`Speed ${speedText(speed)}`}
      selected={speedPercent(current) === speedPercent(speed)}
      onPress={pick}
    />
  );
}

function SpeedGroup() {
  const styles = useStyles();
  const hint = useStemPlayer((s) => speedHint(s.recordedFacts, s.facts));
  return (
    <>
      <View style={styles.row}>
        <Text style={styles.label}>{speedKeyCopy.speed}</Text>
        <SpeedStepper gaps={ROW_GAPS} />
      </View>
      <View style={styles.presets}>
        {SPEED_PRESETS.map((speed) => (
          <SpeedPreset key={speed} speed={speed} />
        ))}
      </View>
      <Text style={styles.hint}>{hint}</Text>
    </>
  );
}

function KeyGroup() {
  const styles = useStyles();
  const hint = useStemPlayer((s) =>
    keyHint(s.recordedFacts, s.facts, s.songKey),
  );
  return (
    <>
      <View style={styles.row}>
        <Text style={styles.label}>{speedKeyCopy.key}</Text>
        <SongKeyStepper gaps={ROW_GAPS} />
      </View>
      <Text style={styles.hint}>{hint}</Text>
    </>
  );
}

function PerStemKeys() {
  const styles = useStyles();
  const [open, setOpen] = useState(false);
  const scaled = useTextScaled();
  const summary = useStemPlayer((s) => perStemSummary(s.stems, s.songKey));
  const toggle = useCallback(() => {
    setOpen((was) => !was);
  }, []);
  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${speedKeyCopy.perStem}, ${summary}`}
        accessibilityState={{ expanded: open }}
        style={styles.toggle}
        onPress={toggle}
      >
        {scaled ? (
          <View testID={PER_STEM_STACKED_ID} style={styles.toggleBody}>
            <Text style={styles.label}>{speedKeyCopy.perStem}</Text>
            <Text style={styles.valueBelow}>{summary}</Text>
          </View>
        ) : (
          <>
            <Text style={styles.label}>{speedKeyCopy.perStem}</Text>
            <Text style={styles.value}>{summary}</Text>
          </>
        )}
        <Icon
          name={open ? 'caretUp' : 'caretDown'}
          size="title"
          color="text2"
        />
      </Pressable>
      {open ? <StemKeyRows /> : null}
    </>
  );
}

export interface SpeedKeySheetProps {
  readonly visible: boolean;
  readonly bottomInset: number;
  readonly onClose: () => void;
}

export function SpeedKeySheet({
  visible,
  bottomInset,
  onClose,
}: SpeedKeySheetProps) {
  return (
    <Sheet
      visible={visible}
      title={speedKeyCopy.title}
      dismissLabel={speedKeyCopy.close}
      bottomInset={bottomInset}
      onDismiss={onClose}
    >
      <SpeedGroup />
      <KeyGroup />
      <PerStemKeys />
    </Sheet>
  );
}
