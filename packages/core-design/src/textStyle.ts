import type { TextStyle } from 'react-native';

import type { TypeRole } from './tokens.ts';

export function textStyle(role: TypeRole): TextStyle {
  const style: TextStyle = {
    fontFamily: role.family,
    fontSize: role.size,
    fontWeight: String(role.weight) as TextStyle['fontWeight'],
  };
  if (role.tracking !== undefined)
    style.letterSpacing = role.size * role.tracking;
  if (role.uppercase === true) style.textTransform = 'uppercase';
  if (role.tabular === true) style.fontVariant = ['tabular-nums'];
  return style;
}
