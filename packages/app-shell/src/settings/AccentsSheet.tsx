import {
  Button,
  createThemedStyles,
  rig,
  Sheet,
  SheetHint,
  space,
  StepControl,
  textRoles,
  textStyle,
  type StepDelta,
} from '@kitbag/core-design';
import { KB_SUBDIVISION_BOUNDS } from '@kitbag/core-native';
import { clamp, useSubdivisionAccents } from '@kitbag/core-state';
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AccentLeds } from './AccentLeds.tsx';
import { accentLabels } from './rigText.ts';
import { CLOSE, SUBDIVISION_ACCENTS } from './settingsLabels.ts';

const SUBDIVISION = 'Subdivision';
const ALL_NORMAL = 'All normal';
const HEAR_IT = 'Hear it';
const HINT =
  'One pattern per subdivision count, for every song that uses it. Tap a tick to accent it; the first tick is the beat, accented by the beat.';

const useStyles = createThemedStyles((theme) => ({
  stepRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.controlGap,
  },
  label: { ...textStyle(textRoles.fieldLabel), color: theme.color.text2 },
  leds: { alignItems: 'center', paddingVertical: rig.accentLedsV },
  slots: {
    ...textStyle(textRoles.fieldLabel),
    color: theme.color.text2,
    textAlign: 'center',
  },
  actions: { flexDirection: 'row', gap: space.controlGap },
}));

const clampCount = (count: number) =>
  clamp(count, KB_SUBDIVISION_BOUNDS.min, KB_SUBDIVISION_BOUNDS.max);

export interface AccentsSheetProps {
  readonly visible: boolean;
  readonly canHear: boolean;
  readonly onHear: (count: number) => void;
  readonly onDismiss: () => void;
}

export function AccentsSheet({
  visible,
  canHear,
  onHear,
  onDismiss,
}: AccentsSheetProps) {
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const lastCount = useSubdivisionAccents((s) => s.lastCount);
  const [count, setCount] = useState(lastCount);
  useEffect(() => {
    if (visible) setCount(lastCount);
    // Opening shows the last-edited count; edits while open must not move it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);
  const mask = useSubdivisionAccents((s) => s.masks[count] ?? 0);
  const toggle = useSubdivisionAccents((s) => s.toggle);
  const reset = useSubdivisionAccents((s) => s.reset);
  const step = useCallback((delta: StepDelta) => {
    setCount((current) => clampCount(current + delta));
  }, []);
  const pressSlot = useCallback(
    (slot: number) => {
      toggle(count, slot);
    },
    [toggle, count],
  );
  const allNormal = useCallback(() => {
    reset(count);
  }, [reset, count]);
  const hear = useCallback(() => {
    onHear(count);
  }, [onHear, count]);
  return (
    <Sheet
      visible={visible}
      title={SUBDIVISION_ACCENTS}
      titleIcon="subdivisionAccents"
      dismissLabel={CLOSE}
      bottomInset={insets.bottom}
      onDismiss={onDismiss}
    >
      <View style={styles.stepRow}>
        <Text style={styles.label}>{SUBDIVISION}</Text>
        <StepControl
          label={SUBDIVISION}
          value={String(count)}
          onStep={step}
          variant="inline"
          wide
        />
      </View>
      <View style={styles.leds}>
        <AccentLeds
          mask={mask}
          count={count}
          size="main"
          onPressSlot={pressSlot}
        />
      </View>
      <Text style={styles.slots}>{accentLabels(mask, count)}</Text>
      <View style={styles.actions}>
        <Button label={ALL_NORMAL} variant="ghost" fill onPress={allNormal} />
        <Button
          label={HEAR_IT}
          icon="play"
          variant="tonal"
          fill
          disabled={!canHear}
          onPress={hear}
        />
      </View>
      <SheetHint>{HINT}</SheetHint>
    </Sheet>
  );
}
