// core-design — tokens, theme, shared components: the waveform renderer, LEDs,
// steppers, sheets, numpad (SPEC §13.1). May import core-plugin-api only.
//
// §12.2's tokens are the sole styling authority (SPEC §13.8.1). The public
// surface is the token module: values (palette, radii, typography, shadow),
// theme resolvers for Skia/RN (`resolveTheme`), NativeWind's vars() payload
// (`themeVars`) and the generator's render functions. The Tailwind theme is
// generated from these — never hand-authored (§13.7).
//
// The shared components named above land in later Phase 2 waves.

export * from './tokens';
