import { describe, expect, it } from 'vitest';

import { miniPlayerDetail } from './miniPlayerDetail.ts';

const FULL = 1;
const SLOWED = 0.9;

describe('miniPlayerDetail', () => {
  it('names the artist and the click state', () => {
    expect(miniPlayerDetail('Foo Fighters', true, FULL)).toBe(
      'Foo Fighters · Click on',
    );
    expect(miniPlayerDetail('Foo Fighters', false, FULL)).toBe(
      'Foo Fighters · Click off',
    );
  });

  it('shows only the click state for a song with no artist', () => {
    expect(miniPlayerDetail(null, true, FULL)).toBe('Click on');
  });

  it('adds the speed while it is off full speed', () => {
    expect(miniPlayerDetail('Foo Fighters', true, SLOWED)).toBe(
      'Foo Fighters · Click on · 90%',
    );
    expect(miniPlayerDetail(null, false, SLOWED)).toBe('Click off · 90%');
  });
});
