// Subdivision badge glyphs. SPEC §5.2 fixes them verbatim: "showing the
// engine's own glyph (♩ ♪ ³ ♬, then ×5…×16)". The engine exports no glyph table
// (nativeConstants.gen.ts carries no symbols), so SPEC is the owner here and
// this transcribes it — it does not invent a second naming of the range.

const NAMED_GLYPHS = ['♩', '♪', '³', '♬'] as const;

/** Badge glyph for a subdivision (1–16, SPEC §5.1). */
export function subdivisionGlyph(subdivision: number): string {
  return NAMED_GLYPHS[subdivision - 1] ?? `×${String(subdivision)}`;
}
