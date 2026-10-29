import { describe, expect, it } from 'vitest';

import { soloAfter } from './mix.ts';

describe('solo', () => {
  const none = [false, false, false];

  it('is exclusive on a tap: the tapped stem plays alone', () => {
    expect(soloAfter([true, false, true], 1, false)).toEqual([
      false,
      true,
      false,
    ]);
    expect(soloAfter(none, 2, false)).toEqual([false, false, true]);
  });

  it('clears on a tap of the stem already playing alone', () => {
    expect(soloAfter([false, true, false], 1, false)).toEqual(none);
  });

  it('adds or removes one stem on a long press and keeps the rest', () => {
    expect(soloAfter([true, false, false], 2, true)).toEqual([
      true,
      false,
      true,
    ]);
    expect(soloAfter([true, false, true], 0, true)).toEqual([
      false,
      false,
      true,
    ]);
  });
});
