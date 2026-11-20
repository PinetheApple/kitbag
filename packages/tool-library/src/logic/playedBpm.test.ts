import { describe, expect, it } from 'vitest';

import { playedBpm } from './playedBpm.ts';

const SLOWED = 0.9;

describe('playedBpm', () => {
  it('scales the song tempo by the speed', () => {
    expect(playedBpm(158, SLOWED)).toBeCloseTo(142.2);
    expect(playedBpm(null, SLOWED)).toBeNull();
  });
});
