import { BPM_LOOKUP_SOURCE } from '@kitbag/core-db';
import { describe, expect, it } from 'vitest';

import { offline } from './http.test-helper.ts';
import { defaultTempoSources } from './onlineSources.ts';

const ids = (key: string | undefined) =>
  defaultTempoSources(offline, key).map(({ id }) => id);

describe('defaultTempoSources', () => {
  it("goes online nowhere without the user's key", () => {
    expect(ids(undefined)).toEqual([]);
    expect(ids('   ')).toEqual([]);
  });

  it("asks GetSongBPM with the user's key", () => {
    expect(ids('test-key')).toEqual([BPM_LOOKUP_SOURCE.getSongBpm]);
  });
});
