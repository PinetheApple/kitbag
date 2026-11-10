import { describe, expect, it } from 'vitest';

import { miniPlayerDetail } from './miniPlayerDetail.ts';

describe('miniPlayerDetail', () => {
  it('names the artist and the click state', () => {
    expect(miniPlayerDetail('Foo Fighters', true)).toBe(
      'Foo Fighters · Click on',
    );
    expect(miniPlayerDetail('Foo Fighters', false)).toBe(
      'Foo Fighters · Click off',
    );
  });

  it('shows only the click state for a song with no artist', () => {
    expect(miniPlayerDetail(null, true)).toBe('Click on');
  });
});
