import { createThemedStyles, textRoles, textStyle } from '@kitbag/core-design';

export const useSheetStyles = createThemedStyles((theme) => ({
  hint: {
    ...textStyle(textRoles.sheetHint),
    color: theme.color.text3,
  },
  centered: {
    textAlign: 'center',
  },
}));
