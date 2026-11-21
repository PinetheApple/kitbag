import {
  createThemedStyles,
  Icon,
  lineRatio,
  minTouchTargetDp,
  radius,
  size,
  space,
  textRoles,
  textStyle,
  useTheme,
} from '@kitbag/core-design';
import type { Ref } from 'react';
import { Text, TextInput, type TextInputInstance, View } from 'react-native';

import { ADDRESS_PLACEHOLDER } from './logic/failureText.ts';

const ADDRESS_LABEL = 'StemDeck address';

const useStyles = createThemedStyles((theme) => ({
  wrap: { flex: 1, minWidth: 0, gap: space.chipGap },
  field: {
    ...textStyle(textRoles.editValue),
    fontVariant: ['tabular-nums'],
    minHeight: minTouchTargetDp,
    paddingVertical: 0,
    paddingHorizontal: space.cardPadding,
    borderRadius: radius.row,
    borderWidth: size.stroke,
    borderColor: theme.color.line,
    backgroundColor: theme.color.surface2,
    color: theme.color.text,
  },
  bad: { borderColor: theme.color.red },
  error: { flexDirection: 'row', gap: space.chipGap },
  errorText: {
    ...textStyle(textRoles.sheetHint),
    lineHeight: textRoles.sheetHint.size * lineRatio.compactBody,
    flex: 1,
    color: theme.color.redInk,
  },
}));

export interface AddressFieldProps {
  readonly value: string;
  readonly error: string | null;
  readonly editable: boolean;
  readonly ref: Ref<TextInputInstance>;
  readonly onChangeText: (text: string) => void;
  readonly onSubmit: () => void;
}

export function AddressField({
  value,
  error,
  editable,
  ref,
  onChangeText,
  onSubmit,
}: AddressFieldProps) {
  const styles = useStyles();
  const theme = useTheme();
  return (
    <View style={styles.wrap}>
      <TextInput
        ref={ref}
        style={[styles.field, error !== null && styles.bad]}
        value={value}
        onChangeText={onChangeText}
        onSubmitEditing={onSubmit}
        placeholder={ADDRESS_PLACEHOLDER}
        placeholderTextColor={theme.color.text3}
        accessibilityLabel={ADDRESS_LABEL}
        editable={editable}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="url"
        returnKeyType="go"
      />
      {error === null ? null : (
        <View style={styles.error}>
          <Icon name="error" size="field" color="red" />
          <Text accessibilityLiveRegion="polite" style={styles.errorText}>
            {error}
          </Text>
        </View>
      )}
    </View>
  );
}
