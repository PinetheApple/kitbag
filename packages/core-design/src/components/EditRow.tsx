import { Children, Fragment, type ReactNode } from 'react';
import { Text, TextInput, View } from 'react-native';

import { inset, size, space, textRoles } from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles, useTheme } from '../ThemeProvider.tsx';
import { radii } from '../tokens.ts';

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
    paddingHorizontal: space.inlineKeyGap,
  },
  key: { ...textStyle(textRoles.editKey), color: theme.color.text2 },
  value: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'flex-end',
    gap: space.controlGap,
    flexShrink: 1,
  },
  input: {
    ...textStyle(textRoles.editValue),
    color: theme.color.text,
    flexGrow: 1,
    padding: 0,
    textAlign: 'right',
  },
  text: { ...textStyle(textRoles.editValue), color: theme.color.text },
  muted: { color: theme.color.text3 },
}));

export function EditGroup({ children }: { readonly children: ReactNode }) {
  const styles = useStyles();
  const rows = Children.toArray(children);
  return (
    <View style={styles.group}>
      {rows.map((row, index) => (
        <Fragment key={index}>
          {index === 0 ? null : <View style={styles.divider} />}
          {row}
        </Fragment>
      ))}
    </View>
  );
}

export interface EditRowProps {
  readonly label: string;
  readonly children: ReactNode;
}

export function EditRow({ label, children }: EditRowProps) {
  const styles = useStyles();
  return (
    <View style={styles.row}>
      <Text style={styles.key}>{label}</Text>
      <View style={styles.value}>{children}</View>
    </View>
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
