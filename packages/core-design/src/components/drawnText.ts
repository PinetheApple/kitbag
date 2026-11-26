import { fontFace } from '../fontFaces.ts';
import { textRoles, type TextRoleName } from '../roles.ts';

type Roles = typeof textRoles;
export type PlainRoleName = {
  [Name in TextRoleName]: Roles[Name] extends
    { readonly tracking: number } | { readonly uppercase: true }
    ? never
    : Name;
}[TextRoleName];

export const TABULAR_FIGURES = "'tnum'";
// Android lays a Text's first line out from the font's top metric; "top" puts the
// svg baseline at the same depth, so the drawing sits where the Text would.
export const TEXT_LINE_TOP = 'top';

export const ANCHOR_AT_CENTRE = 'middle';
// "central" sets the svg baseline half the ascent-minus-descent below the anchor,
// so the glyph's ascent-to-descent box is centred on it.
export const BASELINE_AT_CENTRE = 'central';

export interface DrawnFontOptions {
  readonly tabularOnlyForTabularRoles?: boolean;
}

export function drawnFont(
  role: PlainRoleName,
  fontSize: number,
  { tabularOnlyForTabularRoles = false }: DrawnFontOptions = {},
) {
  const face = textRoles[role];
  const tabular = !tabularOnlyForTabularRoles || 'tabular' in face;
  return {
    fontFamily: fontFace(face.family, face.weight),
    fontSize,
    ...(tabular ? { fontFeatureSettings: TABULAR_FIGURES } : null),
  };
}
