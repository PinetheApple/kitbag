import { KB_ACCENT } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import { beatGroupSizes, groupStartAccents } from './meterGroups.ts';

const { KB_ACCENT_ACCENTED: A, KB_ACCENT_NORMAL: N } = KB_ACCENT;

describe('beatGroupSizes', () => {
  it('groups 7 as 2+2+3', () => {
    expect(beatGroupSizes(7)).toEqual([2, 2, 3]);
  });

  it('chunks a regular bar by four', () => {
    expect(beatGroupSizes(4)).toEqual([4]);
    expect(beatGroupSizes(8)).toEqual([4, 4]);
    expect(beatGroupSizes(16)).toEqual([4, 4, 4, 4]);
  });

  it('groups twelve in threes', () => {
    expect(beatGroupSizes(12)).toEqual([3, 3, 3, 3]);
  });

  it('trails the remainder of an unlisted count', () => {
    expect(beatGroupSizes(13)).toEqual([4, 4, 4, 1]);
  });

  it('has no groups for an empty bar', () => {
    expect(beatGroupSizes(0)).toEqual([]);
  });
});

describe('groupStartAccents', () => {
  it('accents each group start', () => {
    expect(groupStartAccents(7)).toEqual([A, N, A, N, A, N, N]);
    expect(groupStartAccents(12)).toEqual([A, N, N, A, N, N, A, N, N, A, N, N]);
    expect(groupStartAccents(4)).toEqual([A, N, N, N]);
  });
});
