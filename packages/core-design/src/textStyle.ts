import type { TextStyle } from 'react-native';

import { fontFace } from './fontFaces.ts';
import type { TypeRole } from './tokens.ts';

export function textStyle(role: TypeRole): TextStyle {
  // Each weight is its own face; a fontWeight on top makes Android synthesize bold.
  const style: TextStyle = {
    fontFamily: fontFace(role.family, role.weight),
    fontSize: role.size,
  };
  if (role.tracking !== undefined)
    style.letterSpacing = role.size * role.tracking;
  if (role.uppercase === true) style.textTransform = 'uppercase';
  if (role.tabular === true) style.fontVariant = ['tabular-nums'];
  return style;
}
