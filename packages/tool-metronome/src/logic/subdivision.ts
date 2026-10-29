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

export function subdivisionChoices(bounds: {
  readonly min: number;
  readonly max: number;
}): readonly number[] {
  return Array.from(
    { length: bounds.max - bounds.min + 1 },
    (_unused, i) => bounds.min + i,
  );
}

const TILE_COLUMNS = 4;
const LARGE_TEXT_COLUMNS = 2;
const LARGE_TEXT_SCALE = 1.5;

export function subdivisionColumns(fontScale: number): number {
  return fontScale >= LARGE_TEXT_SCALE ? LARGE_TEXT_COLUMNS : TILE_COLUMNS;
}

export function inRows<T>(
  items: readonly T[],
  columns: number,
): readonly T[][] {
  return Array.from({ length: Math.ceil(items.length / columns) }, (_u, row) =>
    items.slice(row * columns, row * columns + columns),
  );
}

export function spokenSubdivision(subdivision: number): string {
  const perBeat = `${String(subdivision)} per beat`;
  const name = subdivisionName(subdivision);
  return name === perBeat ? name : `${name}, ${perBeat}`;
}
