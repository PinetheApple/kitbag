import {
  ARRIVAL,
  SKIP,
  SKIPPED_SONG,
  SKIPPED_STEM_SONG,
  SKIPPED_UNOPENED_SONG,
  SKIPPED_UNOPENED_STEM_SONG,
  type Arrival,
} from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import { arrivalText } from './arrivalText.ts';

const NIGHT_BUS = 8;
const HUM = 8;
const library = {
  stems: new Map([[NIGHT_BUS, { title: 'Night Bus' }]]),
  songs: new Map([[HUM, { title: 'Hum' }]]),
} as never;
const SERIAL = 1;

const playing: Arrival = {
  kind: ARRIVAL.playing,
  serial: SERIAL,
  song: { kind: 'stems', id: NIGHT_BUS },
  place: { number: 3, of: 5 },
  skipped: null,
  inApp: false,
};

describe('what the player says after an advance', () => {
  it('names the song and its place once it plays', () => {
    expect(arrivalText(playing, library)).toBe('Playing Night Bus · 3 of 5');
  });

  it('names a queued single song once it plays', () => {
    expect(
      arrivalText(
        { ...playing, song: { kind: 'song', id: HUM }, place: null },
        library,
      ),
    ).toBe('Playing Hum');
  });

  it('says nothing about a song the in-app Next played', () => {
    expect(arrivalText({ ...playing, inApp: true }, library)).toBeNull();
  });

  it('still says a skip that an in-app Next caused', () => {
    expect(
      arrivalText(
        {
          ...playing,
          inApp: true,
          skipped: { reason: SKIP.deleted, kind: 'stems' },
        },
        library,
      ),
    ).toBe(SKIPPED_STEM_SONG);
  });

  it('says nothing while the song is still opening', () => {
    expect(
      arrivalText(
        {
          kind: ARRIVAL.arriving,
          serial: SERIAL,
          song: { kind: 'stems', id: NIGHT_BUS },
        },
        library,
      ),
    ).toBeNull();
  });

  it('says it skipped a deleted song when nothing plays', () => {
    expect(
      arrivalText(
        {
          kind: ARRIVAL.gaveUp,
          serial: SERIAL,
          skipped: { reason: SKIP.deleted, kind: 'stems' },
        },
        library,
      ),
    ).toBe(SKIPPED_STEM_SONG);
  });

  it('names a skipped single song as a song, not a stem song', () => {
    expect(
      arrivalText(
        {
          kind: ARRIVAL.gaveUp,
          serial: SERIAL,
          skipped: { reason: SKIP.deleted, kind: 'song' },
        },
        library,
      ),
    ).toBe(SKIPPED_SONG);
    expect(
      arrivalText(
        { ...playing, skipped: { reason: SKIP.unopened, kind: 'song' } },
        library,
      ),
    ).toBe(SKIPPED_UNOPENED_SONG);
  });

  it('says it skipped an unopened song once a later one plays', () => {
    expect(
      arrivalText(
        {
          kind: ARRIVAL.playing,
          serial: SERIAL,
          song: { kind: 'stems', id: NIGHT_BUS },
          place: null,
          skipped: { reason: SKIP.unopened, kind: 'stems' },
          inApp: false,
        },
        library,
      ),
    ).toBe(SKIPPED_UNOPENED_STEM_SONG);
  });
});
