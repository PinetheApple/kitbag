import { fontFamily } from './tokens.ts';

export const fontFaces = {
  [fontFamily.display]: {
    400: 'SpaceGrotesk_400Regular',
    500: 'SpaceGrotesk_500Medium',
    600: 'SpaceGrotesk_600SemiBold',
    700: 'SpaceGrotesk_700Bold',
  },
  [fontFamily.body]: {
    400: 'Inter_400Regular',
    600: 'Inter_600SemiBold',
  },
} as const satisfies Record<string, Partial<Record<number, string>>>;

type FaceTable = typeof fontFaces;
export type FontFace = {
  [F in keyof FaceTable]: FaceTable[F][keyof FaceTable[F]];
}[keyof FaceTable];

export function fontFace(family: string, weight: number): FontFace {
  const faces: Partial<Record<number, FontFace>> | undefined = Object.hasOwn(
    fontFaces,
    family,
  )
    ? fontFaces[family as keyof FaceTable]
    : undefined;
  const face = faces?.[weight];
  if (face === undefined) {
    throw new Error(`No bundled face for ${family} ${String(weight)}`);
  }
  return face;
}
