import {
  ARRIVAL,
  SKIP,
  SKIPPED_STEM_SONG,
  SKIPPED_UNOPENED_STEM_SONG,
  type Arrival,
} from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import { arrivalText } from './arrivalText.ts';

const NIGHT_BUS = 8;
const stems = new Map([[NIGHT_BUS, { title: 'Night Bus' }]]) as never;
const SERIAL = 1;

const playing: Arrival = {
  kind: ARRIVAL.playing,
  serial: SERIAL,
  stemSetId: NIGHT_BUS,
  place: { number: 3, of: 5 },
  skipped: null,
};

describe('what the player says after an advance', () => {
  it('names the song and its place once it plays', () => {
    expect(arrivalText(playing, stems)).toBe('Playing Night Bus · 3 of 5');
  });

  it('says nothing while the song is still opening', () => {
    expect(
      arrivalText(
        { kind: ARRIVAL.arriving, serial: SERIAL, stemSetId: NIGHT_BUS },
        stems,
      ),
    ).toBeNull();
  });

  it('says it skipped a deleted song when nothing plays', () => {
    expect(arrivalText({ kind: ARRIVAL.gaveUp, serial: SERIAL }, stems)).toBe(
      SKIPPED_STEM_SONG,
    );
  });

  it('says it skipped an unopened song once a later one plays', () => {
    expect(
      arrivalText(
        {
          kind: ARRIVAL.playing,
          serial: SERIAL,
          stemSetId: NIGHT_BUS,
          place: null,
          skipped: SKIP.unopened,
        },
        stems,
      ),
    ).toBe(SKIPPED_UNOPENED_STEM_SONG);
  });
});
