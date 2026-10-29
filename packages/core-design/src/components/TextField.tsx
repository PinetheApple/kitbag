import type { Ref } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import type { IconName } from '../icons.ts';
import { inset, radius, size, space, textRoles } from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles, useTheme } from '../ThemeProvider.tsx';
import { minTouchTargetDp } from '../tokens.ts';
import { Icon } from './Icon.tsx';

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
  input: {
    ...textStyle(textRoles.search),
    flex: 1,
    padding: 0,
    color: theme.color.text,
  },
  clear: {
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: minTouchTargetDp,
    minHeight: minTouchTargetDp,
  },
}));

export interface TextFieldProps {
  readonly value: string;
  readonly onChangeText: (value: string) => void;
  readonly placeholder: string;
  readonly accessibilityLabel: string;
  readonly icon?: IconName;
  readonly autoFocus?: boolean;
  readonly editable?: boolean;
  readonly ref?: Ref<TextInput>;
  readonly onSubmitEditing?: () => void;
  readonly onClear?: () => void;
}

export function TextField(props: TextFieldProps) {
  const styles = useStyles();
  const theme = useTheme();
  return (
    <View style={styles.field}>
      {props.icon === undefined ? null : (
        <Icon name={props.icon} size="field" color="text3" />
      )}
      <TextInput
        ref={props.ref}
        style={styles.input}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={theme.color.text3}
        accessibilityLabel={props.accessibilityLabel}
        autoFocus={props.autoFocus ?? false}
        editable={props.editable ?? true}
        onSubmitEditing={props.onSubmitEditing}
      />
      {props.onClear === undefined || props.value === '' ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear"
          style={styles.clear}
          onPress={props.onClear}
        >
          <Icon name="failure" size="control" />
        </Pressable>
      )}
    </View>
  );
}

export type SearchFieldProps = Omit<TextFieldProps, 'icon'>;

export function SearchField(props: SearchFieldProps) {
  return <TextField {...props} icon="search" />;
}
