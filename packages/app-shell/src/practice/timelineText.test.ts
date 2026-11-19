import { describe, expect, it } from 'vitest';

import { pauseText, positionText, tempoText } from './timelineText.ts';

const SECOND = 1000;
const MINUTE = 60 * SECOND;

function entry(overrides: object = {}) {
  return {
    kind: 'stretch' as const,
    atMs: 151 * SECOND,
    playedMs: 662 * SECOND,
    startBpm: 96,
    tempoChanges: [{ atMs: 400 * SECOND, bpm: 100 }],
    stretch: {
      from: 0,
      to: 662 * SECOND,
      end: 'song' as const,
      song: null,
      setlist: null,
      settings: null,
      countIn: null,
      tempo: [],
      endBpm: 100,
      avgBpm: 98,
    },
    ...overrides,
  };
}

describe('timeline text', () => {
  it('writes a tempo change at its session time', () => {
    expect(tempoText(entry())).toBe('96 BPM, 100 from 6:40');
  });

  it('writes a ramp from its settings, not its steps', () => {
    const ramp = entry();
    const settings = {
      rampEnabled: true,
      rampStartBpm: 100,
      rampEndBpm: 124,
      rampStep: 4,
      rampLength: 4,
      rampUnit: 0,
      bpm: 100,
    };
    expect(
      tempoText({ ...ramp, stretch: { ...ramp.stretch, settings } } as never),
    ).toBe('Ramp 100 → 124 BPM, +4 every 4 bars');
  });

  it('rounds a pause to minutes', () => {
    expect(pauseText(2 * MINUTE + 10 * SECOND)).toBe('Paused · 2 min');
    expect(pauseText(40 * SECOND)).toBe('Paused · 40 s');
  });

  it('writes the setlist position with the setlist size when known', () => {
    expect(positionText(1, 9)).toBe('1 of 9');
    expect(positionText(1, undefined)).toBe('1');
    expect(positionText(null, 9)).toBeNull();
  });
});
