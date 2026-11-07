import { describe, expect, it } from 'vitest';

import { frameAtTap } from './waveSeek.ts';

const FRAMES = 44100;
const SCREEN = 411;
const PADDING = 26;
const WAVEFORM = SCREEN - PADDING * 2;

describe('frameAtTap', () => {
  it('lands where tapped on the waveform, whatever padding surrounds it', () => {
    const middle = WAVEFORM / 2;
    expect(frameAtTap(middle, WAVEFORM, FRAMES)).toBe(FRAMES / 2);
    expect(frameAtTap(middle, SCREEN, FRAMES)).not.toBe(FRAMES / 2);
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
