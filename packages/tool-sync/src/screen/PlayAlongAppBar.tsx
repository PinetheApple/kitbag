import {
  AppBar,
  barChipRoom,
  Chip,
  CHIP_HEIGHT,
  createThemedStyles,
  KeyBadge,
  opacity,
  screenBar,
  size,
  space,
  StatusPill,
  unshared,
  useTextScaled,
  type AppBarAction,
} from '@kitbag/core-design';
import { useMemo, type ReactNode } from 'react';
import { View } from 'react-native';

const BAR_CHIP_GAPS = {
  top: unshared(barChipRoom(CHIP_HEIGHT)),
  bottom: barChipRoom(CHIP_HEIGHT),
};

const LINE_CHIP_GAPS = { top: unshared(space.controlGap) };

const useStyles = createThemedStyles(() => ({
  barChip: { marginRight: screenBar.chipEnd },
  line: {
    flexDirection: 'row',
    paddingHorizontal: space.screenInset,
    paddingBottom: space.controlGap,
  },
  badge: { top: -size.keyBadgeOffset, right: -size.keyBadgeOffset },
  greyed: { opacity: opacity.muted },
}));

export interface SourceChipProps {
  readonly appLabel: string;
  readonly count: number;
  readonly greyed: boolean;
  readonly onPress: (() => void) | null;
}

function SourceChip({
  appLabel,
  count,
  greyed,
  onPress,
  inBar,
}: SourceChipProps & { readonly inBar: boolean }) {
  const styles = useStyles();
  if (onPress === null)
    return (
      <View style={[inBar && styles.barChip, greyed && styles.greyed]}>
        <StatusPill liveDot label={appLabel} />
      </View>
    );
  return (
    <View style={inBar ? styles.barChip : null}>
      <Chip
        liveDot
        trailingIcon="caretDown"
        label={appLabel}
        muted={greyed}
        accessibilityLabel={`Following ${appLabel}, ${String(count)} apps playing. Change source`}
        neighbourGapDp={inBar ? BAR_CHIP_GAPS : LINE_CHIP_GAPS}
        onPress={onPress}
      />
      <KeyBadge label={String(count)} style={styles.badge} />
    </View>
  );
}

export interface PlayAlongAppBarProps {
  readonly onBack: (() => void) | undefined;
  readonly source: SourceChipProps | null;
  readonly onMenu: (() => void) | null;
}

export function PlayAlongAppBar({
  onBack,
  source,
  onMenu,
}: PlayAlongAppBarProps) {
  const styles = useStyles();
  const scaled = useTextScaled();
  const actions: readonly AppBarAction[] = useMemo(
    () =>
      onMenu === null
        ? []
        : [{ icon: 'more', label: 'Play along menu', onPress: onMenu }],
    [onMenu],
  );
  const chip = (inBar: boolean): ReactNode =>
    source === null ? null : <SourceChip {...source} inBar={inBar} />;
  return (
    <>
      <AppBar
        title="Play along"
        onBack={onBack}
        trailing={scaled ? null : chip(true)}
        actions={actions}
      />
      {scaled && source !== null ? (
        <View style={styles.line}>{chip(false)}</View>
      ) : null}
    </>
  );
}
