import { Pressable, Text, TextInput, View } from 'react-native';

import { icons, type IconName } from '../icons.ts';
import { inset, radius, size, space, textRoles } from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles, useTheme } from '../ThemeProvider.tsx';

const useStyles = createThemedStyles((theme) => ({
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.controlGap,
    paddingVertical: inset.searchV,
    paddingHorizontal: inset.searchH,
    borderRadius: radius.row,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface1,
  },
  glyph: { ...textStyle(textRoles.search), color: theme.color.text3 },
  input: {
    ...textStyle(textRoles.search),
    flex: 1,
    padding: 0,
    color: theme.color.text,
  },
  clear: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: size.transportKey,
    minHeight: size.transportKey,
  },
  clearGlyph: { ...textStyle(textRoles.button), color: theme.color.text2 },
}));

export interface TextFieldProps {
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly placeholder: string;
  readonly accessibilityLabel: string;
  readonly icon?: IconName;
  readonly autoFocus?: boolean;
  readonly onSubmitEditing?: () => void;
  readonly onClear?: () => void;
}

export function TextField(props: TextFieldProps) {
  const styles = useStyles();
  const theme = useTheme();
  return (
    <View style={styles.field}>
      {props.icon === undefined ? null : (
        <Text style={styles.glyph}>{icons[props.icon]}</Text>
      )}
      <TextInput
        style={styles.input}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={theme.color.text3}
        accessibilityLabel={props.accessibilityLabel}
        autoFocus={props.autoFocus ?? false}
        onSubmitEditing={props.onSubmitEditing}
      />
      {props.onClear === undefined || props.value === '' ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear"
          style={styles.clear}
          onPress={props.onClear}
        >
          <Text style={styles.clearGlyph}>{icons.failure}</Text>
        </Pressable>
      )}
    </View>
  );
}

export type SearchFieldProps = Omit<TextFieldProps, 'icon'>;

export function SearchField(props: SearchFieldProps) {
  return <TextField {...props} icon="search" />;
}
