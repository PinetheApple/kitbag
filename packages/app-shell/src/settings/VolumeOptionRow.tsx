import {
  Badge,
  calibration,
  calibrationText,
  createThemedStyles,
  dataFolder,
  Icon,
  inset,
  opacity,
  radius,
  rowLabel,
  size,
  textStyle,
} from '@kitbag/core-design';
import { useCallback } from 'react';
import {
  Pressable,
  Text,
  View,
  type PressableStateCallbackType,
} from 'react-native';

import { IN_USE, type VolumeOption } from './dataFolderText.ts';

const useStyles = createThemedStyles((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: calibration.routeRowGap,
    minHeight: dataFolder.volumeRowMinHeight,
    backgroundColor: theme.color.surface1,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    borderRadius: radius.row,
    paddingVertical: inset.rowV,
    paddingHorizontal: calibration.routeRowH,
  },
  inUse: {
    backgroundColor: theme.activeCardFill,
    borderColor: theme.color.accentDim,
  },
  pressed: { backgroundColor: theme.color.surface2 },
  icon: {
    width: size.toolIcon,
    height: size.toolIcon,
    borderRadius: radius.toolIcon,
    backgroundColor: theme.color.surface2,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  muted: { opacity: opacity.muted },
  text: { flex: 1, minWidth: 0 },
  name: {
    ...textStyle(calibrationText.routeName),
    color: theme.color.text,
  },
  sub: {
    ...textStyle(calibrationText.routeMeta),
    color: theme.color.text2,
  },
  reason: { color: theme.color.amberInk },
}));

function OptionBody({ option }: { readonly option: VolumeOption }) {
  const styles = useStyles();
  const blocked = !option.inUse && !option.offered;
  return (
    <>
      <View style={[styles.icon, blocked && styles.muted]}>
        <Icon
          name={option.volumeUuid === null ? 'internalStorage' : 'sdCard'}
          size="tile"
          color="text"
        />
      </View>
      <View style={styles.text}>
        <Text style={[styles.name, blocked && styles.muted]}>
          {option.name}
        </Text>
        <Text style={[styles.sub, blocked && styles.reason]}>{option.sub}</Text>
      </View>
      {option.inUse ? (
        <Badge tone="success" icon="check" label={IN_USE} />
      ) : null}
      {option.offered ? (
        <Icon name="forward" size="control" color="decor" />
      ) : null}
    </>
  );
}

export interface VolumeOptionRowProps {
  readonly option: VolumeOption;
  readonly disabled: boolean;
  readonly onChoose: (volumeUuid: string | null) => void;
}

export function VolumeOptionRow({
  option,
  disabled,
  onChoose,
}: VolumeOptionRowProps) {
  const styles = useStyles();
  const choose = useCallback(() => {
    onChoose(option.volumeUuid);
  }, [onChoose, option.volumeUuid]);
  const pressableStyle = useCallback(
    ({ pressed }: PressableStateCallbackType) => [
      styles.row,
      pressed && styles.pressed,
    ],
    [styles],
  );
  if (!option.offered) {
    return (
      <View
        accessible
        accessibilityLabel={rowLabel(
          option.name,
          option.inUse ? `${option.sub}, ${IN_USE}` : option.sub,
        )}
        style={[styles.row, option.inUse && styles.inUse]}
      >
        <OptionBody option={option} />
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={rowLabel(option.name, option.sub)}
      accessibilityState={{ disabled }}
      disabled={disabled}
      style={pressableStyle}
      onPress={choose}
    >
      <OptionBody option={option} />
    </Pressable>
  );
}
