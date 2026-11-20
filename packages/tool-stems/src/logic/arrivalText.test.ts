import {
  SKIP,
  SKIPPED_STEM_SONG,
  SKIPPED_UNOPENED_STEM_SONG,
  type Arrival,
} from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import { arrivalText } from './arrivalText.ts';

const NIGHT_BUS = 8;
const stems = new Map([[NIGHT_BUS, { title: 'Night Bus' }]]) as never;

const arrival = (change: Partial<Arrival>): Arrival => ({
  serial: 1,
  stemSetId: NIGHT_BUS,
  place: { number: 3, of: 5 },
  skipped: null,
  played: true,
  ...change,
});

describe('what the player says after an advance', () => {
  it('names the song and its place once it plays', () => {
    expect(arrivalText(arrival({}), stems)).toBe('Playing Night Bus · 3 of 5');
  });

  it('says nothing while the song is still opening', () => {
    expect(arrivalText(arrival({ played: false }), stems)).toBeNull();
  });

  it('says it skipped a deleted song when nothing plays', () => {
    expect(
      arrivalText(
        arrival({ stemSetId: null, skipped: SKIP.deleted, played: false }),
        stems,
      ),
    ).toBe(SKIPPED_STEM_SONG);
  });

  it('says nothing when it gave up after a song that would not open', () => {
    expect(
      arrivalText(
        arrival({ stemSetId: null, skipped: SKIP.unopened, played: false }),
        stems,
      ),
    ).toBeNull();
  });

  it('says it skipped an unopened song once a later one plays', () => {
    expect(arrivalText(arrival({ skipped: SKIP.unopened }), stems)).toBe(
      SKIPPED_UNOPENED_STEM_SONG,
    );
  });
});
