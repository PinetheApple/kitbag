import {
  Badge,
  calibration,
  calibrationText,
  createThemedStyles,
  Icon,
  inset,
  radius,
  size,
  textStyle,
  type IconName,
} from '@kitbag/core-design';
import type { OutputRouteKind } from '@kitbag/core-native';
import { useCallback, type ReactNode } from 'react';
import {
  Pressable,
  Text,
  View,
  type PressableStateCallbackType,
} from 'react-native';

const ROUTE_ICON: Readonly<Record<OutputRouteKind, IconName>> = {
  speaker: 'routeSpeaker',
  wired: 'routeWired',
  bluetooth: 'routeBluetooth',
  usb: 'routeUsb',
  other: 'routeOther',
};

const useStyles = createThemedStyles((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: calibration.routeRowGap,
    backgroundColor: theme.color.surface1,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    borderRadius: radius.row,
    paddingVertical: inset.rowV,
    paddingHorizontal: calibration.routeRowH,
  },
  active: {
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
  text: { flex: 1, minWidth: 0 },
  name: {
    ...textStyle(calibrationText.routeName),
    color: theme.color.text,
  },
  meta: {
    ...textStyle(calibrationText.routeMeta),
    color: theme.color.text2,
  },
}));

export interface RouteRowProps {
  readonly kind: OutputRouteKind;
  readonly title: string;
  readonly meta: string;
  readonly active: boolean;
  readonly offset?: string;
  readonly onPress?: () => void;
}

function RouteRowBody({
  kind,
  title,
  meta,
  active,
  offset,
}: RouteRowProps): ReactNode {
  const styles = useStyles();
  return (
    <>
      <View style={styles.icon}>
        <Icon name={ROUTE_ICON[kind]} size="tile" color="text" />
      </View>
      <View style={styles.text}>
        <Text style={styles.name} numberOfLines={1}>
          {title}
        </Text>
        <Text style={styles.meta} numberOfLines={1}>
          {meta}
        </Text>
      </View>
      {offset === undefined ? null : (
        <Badge tone={active ? 'accent' : 'default'} label={offset} />
      )}
    </>
  );
}

export function RouteRow(props: RouteRowProps) {
  const styles = useStyles();
  const { active, onPress } = props;
  const pressableStyle = useCallback(
    ({ pressed }: PressableStateCallbackType) => [
      styles.row,
      active && styles.active,
      pressed && styles.pressed,
    ],
    [styles, active],
  );
  if (onPress === undefined) {
    return (
      <View style={[styles.row, active && styles.active]}>
        <RouteRowBody {...props} />
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[props.title, props.meta, props.offset]
        .filter((part) => part !== undefined)
        .join(', ')}
      style={pressableStyle}
      onPress={onPress}
    >
      <RouteRowBody {...props} />
    </Pressable>
  );
}
