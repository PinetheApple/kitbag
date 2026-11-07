import { describe, expect, it } from 'vitest';

import {
  clickKeyLabel,
  loopEndFrames,
  loopKeyLabel,
  loopMarks,
  loopNote,
} from './loopText.ts';

const RATE = 100;
const FRAMES = 1000;
const ON = { kind: 'on', startSec: 2, endSec: 5 } as const;
const ARMED = { kind: 'armed', startSec: 2 } as const;

describe('loopMarks', () => {
  it('places the marks as fractions of the song', () => {
    expect(loopMarks(ON, RATE, FRAMES)).toEqual({ start: 0.2, end: 0.5 });
    expect(loopMarks(ARMED, RATE, FRAMES)).toEqual({ start: 0.2, end: null });
  });

  it('has no marks without a loop', () => {
    expect(loopMarks({ kind: 'off' }, RATE, FRAMES)).toBeNull();
  });

  it('stays on the bar for a song of no length', () => {
    expect(loopMarks(ARMED, RATE, 0)).toEqual({ start: 0, end: null });
  });
});

describe('loopNote', () => {
  it('names a failure over the loop it left behind', () => {
    expect(loopNote(ON, 'engine')).toEqual({
      text: 'Loop not set, try again',
      failed: true,
    });
  });

  it('says nothing without a loop', () => {
    expect(loopNote({ kind: 'off' }, null)).toBeNull();
  });

  it('shows a set loop', () => {
    expect(loopNote(ON, null)?.failed).toBe(false);
  });
});

describe('loopEndFrames', () => {
  it('reads the end of a set loop in frames', () => {
    expect(loopEndFrames({ loop: ON, engineRate: RATE })).toBe(500);
  });

  it.each([{ kind: 'off' } as const, ARMED])('has none for %j', (loop) => {
    expect(loopEndFrames({ loop, engineRate: RATE })).toBeNull();
  });
});

describe('clickKeyLabel', () => {
  it('names what a press will do', () => {
    expect(clickKeyLabel(true)).toBe('Stop the click');
    expect(clickKeyLabel(false)).toBe('Click along on the song grid');
  });
});

describe('loopKeyLabel', () => {
  it.each([
    [{ kind: 'off' } as const, 'Loop: set the start here'],
    [ARMED, 'Loop: set the end here'],
    [ON, 'Clear the loop'],
  ])('labels the key for %j', (loop, label) => {
    expect(loopKeyLabel(loop)).toBe(label);
  });
});
