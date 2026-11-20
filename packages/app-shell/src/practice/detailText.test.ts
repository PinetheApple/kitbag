import type { SavedPracticeSession } from '@kitbag/core-db';
import { describe, expect, it } from 'vitest';

import {
  detailHeading,
  missingSongsText,
  repeatHint,
  summaryHint,
} from './detailText.ts';

const NOW = new Date(2026, 10, 2, 20, 41);

const session: SavedPracticeSession = {
  uuid: 's',
  startedAt: new Date(2026, 10, 2, 19, 40),
  durationSeconds: 2538,
  avgBpm: 118.2,
  setlistId: 1,
  setlistName: 'Wedding set',
  songUuids: [],
  log: null,
};

describe('session detail text', () => {
  it('heads the screen with the date and how long ago', () => {
    expect(detailHeading(session.startedAt, NOW)).toEqual({
      title: 'Mon 2 Nov',
      subtitle: 'Today',
    });
    expect(detailHeading(new Date(2026, 9, 29, 18, 30), NOW)).toEqual({
      title: 'Thu 29 Oct',
      subtitle: '4 days ago',
    });
    expect(detailHeading(new Date(2026, 8, 1), NOW).subtitle).toBeUndefined();
  });

  it('sums the session under the total', () => {
    expect(
      summaryHint(session, {
        song: () => undefined,
        setlist: () => undefined,
      }),
    ).toBe('Wedding set · started 19:40 · avg 118 BPM');
  });

  it('says what Repeat loads', () => {
    expect(
      repeatHint({
        kind: 'setlist',
        load: {
          kind: 'setlist',
          setlistId: 1,
          name: 'Wedding set',
          presetId: 2,
          itemId: 3,
        },
        songs: new Map(),
      }),
    ).toBe(
      'Loads Wedding set at song 1 with each song as played. You press Play.',
    );
  });

  it('counts the songs that are gone', () => {
    expect(missingSongsText(1)).toBe('1 song no longer in the library');
  });
});
