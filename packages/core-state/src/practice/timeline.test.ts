import { PRACTICE_LOG_VERSION, type LoggedStretch } from '@kitbag/core-db';
import { describe, expect, it } from 'vitest';

import { sessionTimeline, TIMELINE_ENTRY } from './timeline.ts';

const SECOND = 1000;
const MINUTE = 60 * SECOND;

function stretch(
  from: number,
  to: number,
  extra: Partial<LoggedStretch> = {},
): LoggedStretch {
  return {
    from,
    to,
    end: 'song',
    song: { uuid: 'song', title: 'Song' },
    setlist: null,
    settings: null,
    countIn: null,
    tempo: [],
    endBpm: 96,
    avgBpm: 96,
    ...extra,
  };
}

describe('sessionTimeline', () => {
  it('places each stretch at its play-time offset and turns gaps into pauses', () => {
    const entries = sessionTimeline({
      v: PRACTICE_LOG_VERSION,
      stretches: [
        stretch(0, 2 * MINUTE),
        stretch(2 * MINUTE, 5 * MINUTE),
        stretch(7 * MINUTE, 8 * MINUTE),
      ],
    });
    expect(entries).toMatchObject([
      { kind: TIMELINE_ENTRY.stretch, atMs: 0, playedMs: 2 * MINUTE },
      { kind: TIMELINE_ENTRY.stretch, atMs: 2 * MINUTE, playedMs: 3 * MINUTE },
      { kind: TIMELINE_ENTRY.pause, ms: 2 * MINUTE },
      { kind: TIMELINE_ENTRY.stretch, atMs: 5 * MINUTE, playedMs: MINUTE },
    ]);
  });

  it('places tempo changes on the session play time', () => {
    const [, second] = sessionTimeline({
      v: PRACTICE_LOG_VERSION,
      stretches: [
        stretch(0, MINUTE),
        stretch(2 * MINUTE, 4 * MINUTE, { tempo: [[30 * SECOND, 100]] }),
      ],
    }).filter((entry) => entry.kind === TIMELINE_ENTRY.stretch);
    expect(second?.tempoChanges).toEqual([
      { atMs: MINUTE + 30 * SECOND, bpm: 100 },
    ]);
  });

  it('reads an empty log as an empty timeline', () => {
    expect(sessionTimeline({ v: PRACTICE_LOG_VERSION, stretches: [] })).toEqual(
      [],
    );
  });
});
