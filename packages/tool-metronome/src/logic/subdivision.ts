// Subdivision badge label: clicks per beat, ×1 to ×16 (SPEC §5.2, §5.1).
export function subdivisionLabel(subdivision: number): string {
  return `×${String(subdivision)}`;
}

const NOTE_NAMES = [
  'Quarters',
  'Eighths',
  'Triplets',
  'Sixteenths',
  'Quintuplets',
  'Sextuplets',
  'Septuplets',
  '32nds',
] as const;
const SIXTY_FOURTHS = 16;

export function subdivisionName(subdivision: number): string {
  if (subdivision === SIXTY_FOURTHS) return '64ths';
  return NOTE_NAMES[subdivision - 1] ?? `${String(subdivision)} per beat`;
}
