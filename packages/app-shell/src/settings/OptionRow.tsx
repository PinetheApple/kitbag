import {
  createThemedStyles,
  Icon,
  inset,
  lineLimit,
  opacity,
  optionRow,
  optionRowText,
  radius,
  size,
  textStyle,
  UNLIMITED_LINES,
  type IconName,
} from '@kitbag/core-design';
import { useCallback, useMemo, type ReactNode } from 'react';
import {
  Pressable,
  Text,
  useWindowDimensions,
  View,
  type PressableStateCallbackType,
} from 'react-native';

const ONE_LINE = 1;

const useStyles = createThemedStyles((theme) => ({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: optionRow.gap,
    backgroundColor: theme.color.surface1,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    borderRadius: radius.row,
    paddingVertical: inset.rowV,
    paddingHorizontal: optionRow.padH,
  },
  highlighted: {
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
  title: {
    ...textStyle(optionRowText.title),
    color: theme.color.text,
  },
  meta: {
    ...textStyle(optionRowText.meta),
    color: theme.color.text2,
  },
  reason: { color: theme.color.amberInk },
}));

export interface OptionRowProps {
  readonly icon: IconName;
  readonly title: string;
  readonly meta: string;
  readonly accessibilityLabel?: string;
  readonly highlighted?: boolean;
  readonly dimmed?: boolean;
  readonly singleLine?: boolean;
  readonly minHeight?: number;
  readonly trailing?: ReactNode;
  readonly disabled?: boolean;
  readonly onPress?: (() => void) | undefined;
}

function OptionRowBody({
  icon,
  title,
  meta,
  dimmed = false,
  singleLine = false,
  trailing,
}: OptionRowProps) {
  const styles = useStyles();
  const fontScale = useWindowDimensions().fontScale;
  const lines = singleLine ? lineLimit(fontScale, ONE_LINE) : UNLIMITED_LINES;
  return (
    <>
      <View style={[styles.icon, dimmed && styles.muted]}>
        <Icon name={icon} size="tile" color="text" />
      </View>
      <View style={styles.text}>
        <Text
          style={[styles.title, dimmed && styles.muted]}
          numberOfLines={lines}
        >
          {title}
        </Text>
        <Text
          style={[styles.meta, dimmed && styles.reason]}
          numberOfLines={lines}
        >
          {meta}
        </Text>
      </View>
      {trailing}
    </>
  );
}

export function OptionRow(props: OptionRowProps) {
  const styles = useStyles();
  const { highlighted = false, minHeight, disabled, onPress } = props;
  const sized = useMemo(
    () => (minHeight === undefined ? undefined : { minHeight }),
    [minHeight],
  );
  const pressableStyle = useCallback(
    ({ pressed }: PressableStateCallbackType) => [
      styles.row,
      sized,
      highlighted && styles.highlighted,
      pressed && styles.pressed,
    ],
    [styles, sized, highlighted],
  );
  if (onPress === undefined) {
    return (
      <View
        {...(props.accessibilityLabel === undefined
          ? {}
          : { accessible: true, accessibilityLabel: props.accessibilityLabel })}
        style={[styles.row, sized, highlighted && styles.highlighted]}
      >
        <OptionRowBody {...props} />
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={props.accessibilityLabel}
      {...(disabled === undefined
        ? {}
        : { disabled, accessibilityState: { disabled } })}
      style={pressableStyle}
      onPress={onPress}
    >
      <OptionRowBody {...props} />
    </Pressable>
  );
}
