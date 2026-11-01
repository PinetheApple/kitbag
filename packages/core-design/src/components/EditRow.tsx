import {
  Children,
  Fragment,
  useCallback,
  useMemo,
  type ReactNode,
} from 'react';
import {
  Pressable,
  Text,
  TextInput,
  View,
  type AccessibilityRole,
  type PressableStateCallbackType,
} from 'react-native';

import { bodyLineHeight, inset, size, space, textRoles } from '../roles.ts';
import { switchA11y } from '../switch.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles, useTheme } from '../ThemeProvider.tsx';
import { minTouchTargetDp, radii } from '../tokens.ts';
import { Icon } from './Icon.tsx';
import { SwitchTrack } from './Switch.tsx';

export const EDIT_ROW_PRESSABLE_GAP = inset.editRowV + size.stroke;

const useStyles = createThemedStyles((theme) => ({
  group: {
    paddingVertical: inset.editGroupV,
    paddingHorizontal: inset.editGroupH,
    borderRadius: radii.card,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface1,
  },
  divider: { height: size.stroke, backgroundColor: theme.color.line },
  row: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.rowGap,
    paddingVertical: inset.editRowV,
    paddingHorizontal: inset.editRowH,
  },
  singleLine: { flexWrap: 'nowrap' },
  pressableRow: { minHeight: minTouchTargetDp },
  pressed: { backgroundColor: theme.color.surface2 },
  label: {
    ...textStyle(textRoles.editRowKey),
    lineHeight: textRoles.editRowKey.size * bodyLineHeight,
    color: theme.color.text2,
    flexShrink: 0,
  },
  value: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: space.controlGap,
    flexShrink: 1,
    minWidth: 0,
  },
  input: {
    ...textStyle(textRoles.editValue),
    color: theme.color.text,
    flexGrow: 1,
    padding: 0,
    textAlign: 'right',
  },
  text: {
    ...textStyle(textRoles.editValue),
    lineHeight: textRoles.editValue.size * bodyLineHeight,
    color: theme.color.text,
  },
  muted: { color: theme.color.text3 },
  path: { flexShrink: 1 },
}));

export function EditDivider() {
  const styles = useStyles();
  return <View style={styles.divider} />;
}

export function EditGroup({ children }: { readonly children: ReactNode }) {
  const styles = useStyles();
  const rows = Children.toArray(children);
  return (
    <View style={styles.group}>
      {rows.map((row, index) => (
        <Fragment key={index}>
          {index === 0 ? null : <EditDivider />}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

export interface EditRowProps {
  readonly label: string;
  readonly children?: ReactNode;
  readonly singleLine?: boolean;
  readonly onPress?: () => void;
  readonly accessibilityRole?: AccessibilityRole;
  readonly accessibilityLabel?: string;
  /** A fixed-height row: the control is centred in it with no vertical padding. */
  readonly minHeight?: number;
}

export function EditRow({
  label,
  children,
  singleLine = false,
  onPress,
  accessibilityRole = 'button',
  accessibilityLabel,
  minHeight,
}: EditRowProps) {
  const styles = useStyles();
  const fixed = useMemo(
    () =>
      minHeight === undefined ? undefined : { minHeight, paddingVertical: 0 },
    [minHeight],
  );
  const pressableStyle = useCallback(
    ({ pressed }: PressableStateCallbackType) => [
      styles.row,
      singleLine && styles.singleLine,
      styles.pressableRow,
      pressed && styles.pressed,
    ],
    [styles, singleLine],
  );
  if (onPress === undefined) {
    return (
      <View style={[styles.row, singleLine && styles.singleLine, fixed]}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.value}>{children}</View>
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel ?? label}
      style={pressableStyle}
      onPress={onPress}
    >
      <Text style={styles.label}>{label}</Text>
      <View style={styles.value}>
        {children}
        <Icon name="forward" size="control" color="text3" />
      </View>
    </Pressable>
  );
}

export interface EditSwitchRowProps {
  readonly label: string;
  readonly value: boolean;
  readonly onValueChange: (value: boolean) => void;
}

export function EditSwitchRow({
  label,
  value,
  onValueChange,
}: EditSwitchRowProps) {
  const styles = useStyles();
  const pressableStyle = useCallback(
    ({ pressed }: PressableStateCallbackType) => [
      styles.row,
      styles.pressableRow,
      pressed && styles.pressed,
    ],
    [styles],
  );
  const toggle = useCallback(() => {
    onValueChange(!value);
  }, [onValueChange, value]);
  return (
    <Pressable
      {...switchA11y(value)}
      accessibilityLabel={label}
      style={pressableStyle}
      onPress={toggle}
    >
      <Text style={styles.label}>{label}</Text>
      <SwitchTrack value={value} />
    </Pressable>
  );
}

export function EditValue({
  children,
  muted = false,
}: {
  readonly children: ReactNode;
  readonly muted?: boolean;
}) {
  const styles = useStyles();
  return <Text style={[styles.text, muted && styles.muted]}>{children}</Text>;
}

export function EditPath({ children }: { readonly children: string }) {
  const styles = useStyles();
  return (
    <Text
      style={[styles.text, styles.path]}
      numberOfLines={1}
      ellipsizeMode="head"
    >
      {children}
    </Text>
  );
}

export interface EditTextInputProps {
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly accessibilityLabel: string;
  readonly placeholder: string;
}

export function EditTextInput(props: EditTextInputProps) {
  const styles = useStyles();
  const theme = useTheme();
  return (
    <TextInput
      style={styles.input}
      value={props.value}
      onChangeText={props.onChangeText}
      placeholder={props.placeholder}
      placeholderTextColor={theme.color.text3}
      accessibilityLabel={props.accessibilityLabel}
    />
  );
}
