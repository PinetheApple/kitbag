import { describe, expect, it } from 'vitest';

import { formatClock, framesToSeconds, secondsToFrames } from './time.ts';

const RATE_44K = 44100;

describe('engine frames and song time', () => {
  it('formats against the engine rate it is given, not 48 kHz', () => {
    expect(formatClock(RATE_44K * 61, RATE_44K)).toBe('1:01');
    expect(formatClock(48000 * 61, RATE_44K)).toBe('1:06');
  });

  it('round-trips seconds through frames at a non-48k rate', () => {
    expect(secondsToFrames(2.5, RATE_44K)).toBe(110250);
    expect(framesToSeconds(110250, RATE_44K)).toBe(2.5);
  });

  it('reads zero when there is no engine rate yet', () => {
    expect(formatClock(1000, 0)).toBe('0:00');
  });
});
