import { describe, expect, it } from 'vitest';

import { drawsNotation, notationLayout } from './notation.ts';

// Expected values are the mockup's subdivision SVGs (design/kitbag-metronome-b.html).
const near = (actual: number, expected: number) => {
  expect(Math.abs(actual - expected)).toBeLessThan(0.06);
};

describe('notationLayout', () => {
  it('draws a quarter as one stemmed head and nothing else', () => {
    const quarter = notationLayout(1);
    near(quarter.width, 10);
    expect(quarter.headXs).toEqual([4]);
    near(quarter.stemXs[0] ?? 0, 6.4);
    expect(quarter.beams).toEqual([]);
    expect(quarter.numeral).toBeNull();
  });

  it('beams eighths once across both stems', () => {
    const eighths = notationLayout(2);
    near(eighths.width, 17.5);
    expect(eighths.headXs).toEqual([4, 11.5]);
    near(eighths.beamX, 6.4);
    near(eighths.beamWidth, 8.7);
    expect(eighths.beams).toEqual([{ y: 8 }]);
    expect(eighths.numeral).toBeNull();
  });

  it('marks triplets with a centred 3 over one beam', () => {
    const triplets = notationLayout(3);
    near(triplets.width, 25);
    expect(triplets.beams).toHaveLength(1);
    expect(triplets.numeral?.text).toBe('3');
    near(triplets.numeral?.x ?? 0, 14.5);
  });

  it('narrows the spacing past four notes', () => {
    const quintuplets = notationLayout(5);
    expect(quintuplets.headXs).toEqual([4, 9.5, 15, 20.5, 26]);
    near(quintuplets.width, 32);
    near(quintuplets.beamWidth, 23.2);
    near(quintuplets.numeral?.x ?? 0, 18);
  });

  it('caps the drawn heads at eight and counts beams by powers of two', () => {
    const beams = [1, 2, 3, 4, 7, 8, 9, 15, 16].map(
      (n) => notationLayout(n).beams.length,
    );
    expect(beams).toEqual([0, 1, 1, 2, 2, 3, 3, 3, 4]);
    expect(notationLayout(16).headXs).toHaveLength(8);
    near(notationLayout(12).width, 48.5);
    [8, 11.4, 14.8, 18.2].forEach((y, i) => {
      near(notationLayout(16).beams[i]?.y ?? 0, y);
    });
  });

  it('numbers every tuplet and no power of two', () => {
    const numbered = Array.from({ length: 16 }, (_u, i) => i + 1).filter(
      (n) => notationLayout(n).numeral !== null,
    );
    expect(numbered).toEqual([3, 5, 6, 7, 9, 10, 11, 12, 13, 14, 15]);
    near(notationLayout(9).numeral?.x ?? 0, 26.2);
  });
});

const SUBDIVISIONS = Array.from({ length: 16 }, (_u, i) => i + 1);

const drawnIn = (denominator: number) =>
  SUBDIVISIONS.filter((n) => drawsNotation(n, denominator));

const beamsIn = (denominator: number) =>
  drawnIn(denominator).map((n) => notationLayout(n, denominator).beams.length);

describe('drawsNotation', () => {
  it('draws every subdivision in 4/4 and defaults to it', () => {
    expect(drawnIn(4)).toEqual(SUBDIVISIONS);
    expect(beamsIn(4)).toEqual(
      SUBDIVISIONS.map((n) => notationLayout(n).beams.length),
    );
  });

  it.each([
    { beats: 6, denominator: 8 },
    { beats: 12, denominator: 8 },
  ])(
    'beams one deeper in $beats/$denominator and drops what the tiles never draw',
    ({ denominator }) => {
      expect(drawnIn(denominator)).toEqual([
        2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
      ]);
      expect(beamsIn(denominator)).toEqual([
        2, 2, 3, 3, 3, 3, 4, 4, 4, 4, 4, 4, 4, 4,
      ]);
    },
  );

  it('beams one shallower in 2/2 and drops halves and unbeamed groups', () => {
    expect(drawnIn(2)).toEqual([4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16]);
    expect(beamsIn(2)).toEqual([1, 1, 1, 1, 2, 2, 2, 2, 2, 2, 2, 2, 3]);
  });
});
