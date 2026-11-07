import { describe, expect, it } from 'vitest';

import { frameAtTap } from './waveSeek.ts';

const FRAMES = 44100;
const WAVEFORM = 359;

describe('frameAtTap', () => {
  it('lands where tapped on the waveform', () => {
    expect(frameAtTap(WAVEFORM / 2, WAVEFORM, FRAMES)).toBe(FRAMES / 2);
  });

  it('reaches both ends of the song at the waveform edges', () => {
    expect(frameAtTap(0, WAVEFORM, FRAMES)).toBe(0);
    expect(frameAtTap(WAVEFORM, WAVEFORM, FRAMES)).toBe(FRAMES);
  });

  it('stays inside the song for a tap past an edge', () => {
    expect(frameAtTap(-5, WAVEFORM, FRAMES)).toBe(0);
    expect(frameAtTap(WAVEFORM + 5, WAVEFORM, FRAMES)).toBe(FRAMES);
  });

  it.each([
    ['the waveform has no width yet', 0, FRAMES],
    ['the song has no length', WAVEFORM, 0],
  ])('does not seek when %s', (_, width, frames) => {
    expect(frameAtTap(10, width, frames)).toBeNull();
  });
});
