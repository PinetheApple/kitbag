import { space, textRoles, textStyle, type Theme } from '@kitbag/core-design';

export const ACTIONS_ROW = {
  flexDirection: 'row',
  gap: space.controlGap,
} as const;

export function restoreTextStyles(theme: Theme) {
  return {
    banner: { ...textStyle(textRoles.fieldLabel), color: theme.color.text },
    hint: { ...textStyle(textRoles.fieldLabel), color: theme.color.text3 },
  };
}
