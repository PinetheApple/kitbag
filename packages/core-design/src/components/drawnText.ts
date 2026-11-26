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

export function drawnFont(role: PlainRoleName, fontSize: number) {
  const face = textRoles[role];
  return {
    fontFamily: fontFace(face.family, face.weight),
    fontSize,
    fontFeatureSettings: TABULAR_FIGURES,
  };
}
