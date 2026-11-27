import { describe, expect, it } from 'vitest';

import { artistLead, trackClock, UNKNOWN_ARTIST } from './nowPlaying.ts';

const POSITION_MS = 72_000;
const DURATION_MS = 200_000;
const LONG_SET_MS = 3_731_000;

describe('trackClock', () => {
  it('draws position over duration', () => {
    expect(trackClock(POSITION_MS, DURATION_MS)).toBe('1:12 / 3:20');
  });

  it('shows hours on a long set', () => {
    expect(trackClock(POSITION_MS, LONG_SET_MS)).toBe('1:12 / 1:02:11');
  });

  it('never runs the position past the end', () => {
    expect(trackClock(DURATION_MS + POSITION_MS, DURATION_MS)).toBe(
      '3:20 / 3:20',
    );
  });

  it('shows the position alone when the player gives no duration', () => {
    expect(trackClock(POSITION_MS, null)).toBe('1:12');
  });

  it('shows nothing when the player gives no position', () => {
    expect(trackClock(null, DURATION_MS)).toBeNull();
  });
});

describe('artistLead', () => {
  it('says the artist is unknown rather than leaving a gap', () => {
    expect(artistLead(null)).toBe(`${UNKNOWN_ARTIST} · `);
  });
});
