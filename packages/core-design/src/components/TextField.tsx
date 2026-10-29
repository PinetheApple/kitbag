import type { Ref } from 'react';
import { Pressable, TextInput, View } from 'react-native';

import type { IconName } from '../icons.ts';
import { libraryList } from '../libraryRoles.ts';
import { inset, radius, size, space, textRoles } from '../roles.ts';
import { textStyle } from '../textStyle.ts';
import { createThemedStyles, useTheme } from '../ThemeProvider.tsx';
import { minTouchTargetDp } from '../tokens.ts';
import { hitBoxStyle, hitExtension } from '../touchTarget.ts';
import { Icon } from './Icon.tsx';

export type TextFieldVariant = 'default' | 'list';

const LIST_CLEAR_HIT_BOX = hitBoxStyle(
  hitExtension(minTouchTargetDp, libraryList.searchHeight, {
    top: libraryList.bodyTop,
    bottom: libraryList.bodyGap,
  }),
);

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
  listField: {
    minHeight: libraryList.searchHeight,
    flexDirection: 'row',
    alignItems: 'center',
    gap: libraryList.searchGap,
    paddingLeft: libraryList.searchH,
    borderRadius: radius.row,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface1,
  },
  listInput: {
    ...textStyle(textRoles.listSearch),
    flex: 1,
    padding: 0,
    paddingRight: libraryList.searchH,
    color: theme.color.text,
  },
  listClear: {
    ...LIST_CLEAR_HIT_BOX,
    width: minTouchTargetDp,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
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
  readonly variant?: TextFieldVariant;
}

export function TextField(props: TextFieldProps) {
  const styles = useStyles();
  const theme = useTheme();
  const list = props.variant === 'list';
  const quiet = list ? 'text2' : 'text3';
  return (
    <View style={list ? styles.listField : styles.field}>
      {props.icon === undefined ? null : (
        <Icon
          name={props.icon}
          size={list ? 'listSearch' : 'field'}
          color={quiet}
        />
      )}
      <TextInput
        ref={props.ref}
        style={list ? styles.listInput : styles.input}
        value={props.value}
        onChangeText={props.onChangeText}
        placeholder={props.placeholder}
        placeholderTextColor={theme.color[quiet]}
        accessibilityLabel={props.accessibilityLabel}
        autoFocus={props.autoFocus ?? false}
        editable={props.editable ?? true}
        onSubmitEditing={props.onSubmitEditing}
      />
      {props.onClear === undefined || props.value === '' ? null : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Clear"
          style={list ? styles.listClear : styles.clear}
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
