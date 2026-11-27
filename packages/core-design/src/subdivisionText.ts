export function subdivisionLabel(subdivision: number): string {
  return `×${String(subdivision)}`;
}

const NOTE_VALUE_NAMES: Readonly<Record<number, string>> = {
  2: 'Halves',
  4: 'Quarters',
  8: 'Eighths',
  16: 'Sixteenths',
  32: '32nds',
  64: '64ths',
  128: '128ths',
  256: '256ths',
};

const TUPLET_NAMES: Readonly<Record<number, string>> = {
  3: 'Triplets',
  5: 'Quintuplets',
  6: 'Sextuplets',
  7: 'Septuplets',
};

function perBeat(subdivision: number): string {
  return `${String(subdivision)} per beat`;
}

export function subdivisionName(
  subdivision: number,
  denominator: number,
): string {
  const noteValue = subdivision * denominator;
  return (
    NOTE_VALUE_NAMES[noteValue] ??
    TUPLET_NAMES[subdivision] ??
    perBeat(subdivision)
  );
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

export function spokenSubdivision(
  subdivision: number,
  denominator: number,
): string {
  const count = perBeat(subdivision);
  const name = subdivisionName(subdivision, denominator);
  return name === count ? name : `${name}, ${count}`;
}
