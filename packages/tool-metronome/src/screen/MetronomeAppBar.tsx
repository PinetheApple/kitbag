import {
  AppBar,
  createThemedStyles,
  hitSlopFor,
  Icon,
  inset,
  mix,
  mixHex,
  radius,
  size,
  space,
  textRoles,
  textStyle,
  useTheme,
  type ColorToken,
  type ThemeMode,
} from '@kitbag/core-design';
import { useLibrary } from '@kitbag/core-state';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  activeSetOf,
  setlistChipA11yLabel,
  setlistChipLabel,
} from '../logic/setlistChip.ts';

// The mockup draws the active chip in accentDeep on Daylight, accent on Stage.
const activeInk = (mode: ThemeMode): ColorToken =>
  mode === 'dark' ? 'accent' : 'accentDeep';

const CHIP_TO_BODY = (size.appBar - size.setChip) / 2 + space.belowAppBar;
const CHIP_HIT_SLOP = hitSlopFor(size.setChip, CHIP_TO_BODY);

const useStyles = createThemedStyles((theme) => ({
  bar: {
    minHeight: size.appBar,
    justifyContent: 'center',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    gap: space.inlineKeyGap,
    minHeight: size.setChip,
    paddingLeft: inset.setChipLeft,
    paddingRight: inset.setChipRight,
    borderRadius: radius.chip,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface2,
  },
  chipActive: {
    borderColor: theme.color.accentDim,
    backgroundColor: mixHex(
      theme.color.accent,
      theme.color.surface2,
      mix.setChip,
    ),
  },
  label: {
    ...textStyle(textRoles.setChip),
    color: theme.color.text,
    flexShrink: 1,
  },
  labelActive: {
    color: theme.color[activeInk(theme.mode)],
  },
}));

function SetlistChip({ onPress }: { readonly onPress: () => void }) {
  const styles = useStyles();
  const setlists = useLibrary((s) => s.setlists);
  const entries = useLibrary((s) => s.entries);
  const loadedItemId = useLibrary((s) => s.loaded?.itemId ?? null);
  const active = useMemo(
    () => activeSetOf(setlists, entries, loadedItemId),
    [setlists, entries, loadedItemId],
  );
  const on = active !== undefined;
  const ink = activeInk(useTheme().mode);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={setlistChipA11yLabel(active)}
      accessibilityHint="Opens setlists"
      hitSlop={CHIP_HIT_SLOP}
      style={[styles.chip, on && styles.chipActive]}
      onPress={onPress}
    >
      <Text style={[styles.label, on && styles.labelActive]} numberOfLines={1}>
        {setlistChipLabel(active)}
      </Text>
      <Icon name="caretDown" size="caret" color={on ? ink : 'text3'} />
    </Pressable>
  );
}

interface MetronomeAppBarProps {
  readonly onBack?: (() => void) | undefined;
  readonly onOpenSetlists?: (() => void) | undefined;
}

export function MetronomeAppBar({
  onBack,
  onOpenSetlists,
}: MetronomeAppBarProps) {
  const styles = useStyles();
  return (
    <View style={styles.bar}>
      <AppBar
        title="Metronome"
        {...(onBack === undefined ? {} : { onBack })}
        trailing={
          onOpenSetlists === undefined ? undefined : (
            <SetlistChip onPress={onOpenSetlists} />
          )
        }
      />
    </View>
  );
}
