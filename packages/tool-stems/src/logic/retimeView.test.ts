import { describe, expect, it } from 'vitest';

import {
  hasUnsavedRetime,
  leaveRetimeBody,
  retimePreview,
  retimeSubtitle,
  shiftLabel,
  tapTimeLabel,
} from './retimeView.ts';

const lines = [
  { timeSec: 1, text: 'one' },
  { timeSec: 2, text: '' },
  { timeSec: 3, text: 'two' },
  { timeSec: 4, text: 'three' },
];

describe('retimeSubtitle', () => {
  it('counts sung lines only', () => {
    expect(retimeSubtitle(lines, 0, null)).toBe('Line 1 of 3');
    expect(retimeSubtitle(lines, 2, null)).toBe('Line 2 of 3');
    expect(retimeSubtitle(lines, 3, null)).toBe('Line 3 of 3');
  });

  it('says when every line is tapped', () => {
    expect(retimeSubtitle(lines, -1, null)).toBe('All 3 lines tapped');
  });

  it('prints a single-precision speed as the speed', () => {
    expect(retimeSubtitle(lines, 0, Math.fround(0.6))).toBe(
      'Line 1 of 3 · playing at 0.6×',
    );
    expect(retimeSubtitle(lines, 0, Math.fround(0.75))).toBe(
      'Line 1 of 3 · playing at 0.75×',
    );
  });

  it('adds the speed the mixer plays', () => {
    expect(retimeSubtitle(lines, 0, 0.75)).toBe(
      'Line 1 of 3 · playing at 0.75×',
    );
    expect(retimeSubtitle(lines, -1, 0.75)).toBe(
      'All 3 lines tapped · playing at 0.75×',
    );
  });
});

describe('retimePreview', () => {
  it('has the line to tap and the next sung one before any tap', () => {
    expect(retimePreview(lines, [], 0)).toEqual({
      done: null,
      current: 'one',
      next: 'two',
    });
  });

  it('shows the last tap with its time, skipping a blank line', () => {
    expect(retimePreview(lines, [{ line: 0, timeSec: 80.4 }], 2)).toEqual({
      done: { text: 'one', time: '1:20.4' },
      current: 'two',
      next: 'three',
    });
  });

  it('has no current line once every line is tapped', () => {
    expect(retimePreview(lines, [{ line: 3, timeSec: 5 }], -1)).toEqual({
      done: { text: 'three', time: '0:05.0' },
      current: null,
      next: null,
    });
  });
});

describe('tapTimeLabel', () => {
  it('keeps one decimal and rounds into the next second', () => {
    expect(tapTimeLabel(80.44)).toBe('1:20.4');
    expect(tapTimeLabel(59.96)).toBe('1:00.0');
  });
});

describe('shiftLabel', () => {
  it('signs a step in seconds', () => {
    expect(shiftLabel(1)).toBe('+0.10 s');
    expect(shiftLabel(-3)).toBe('−0.30 s');
    expect(shiftLabel(0)).toBe('0.00 s');
  });
});

const recording = {
  kind: 'recording',
  taps: [],
  nextLine: 0,
  shiftSteps: 0,
  playbackRate: null,
} as const;

function unsaved(taps: number, shiftSteps: number) {
  return {
    ...recording,
    taps: Array.from({ length: taps }, (_, line) => ({ line, timeSec: line })),
    shiftSteps,
  };
}

describe('leaveRetimeBody', () => {
  const kept = 'The lyrics keep their current timing.';

  it('counts the taps in the drawn words', () => {
    expect(leaveRetimeBody(unsaved(5, 0))).toBe(
      `Your 5 taps for this song are dropped. ${kept}`,
    );
    expect(leaveRetimeBody(unsaved(1, 0))).toBe(
      `Your 1 tap for this song is dropped. ${kept}`,
    );
  });

  it('names the offset when there is a shift', () => {
    expect(leaveRetimeBody(unsaved(0, -2))).toBe(
      `Your offset for this song is dropped. ${kept}`,
    );
    expect(leaveRetimeBody(unsaved(2, 1))).toBe(
      `Your 2 taps and offset for this song are dropped. ${kept}`,
    );
    expect(leaveRetimeBody(unsaved(1, 1))).toBe(
      `Your 1 tap and offset for this song are dropped. ${kept}`,
    );
  });

  it('has nothing to say with no taps and no shift, or out of retime', () => {
    expect(leaveRetimeBody(recording)).toBeNull();
    expect(leaveRetimeBody({ kind: 'off' })).toBeNull();
  });
});

describe('hasUnsavedRetime', () => {
  it('is set by a tap or a shift, and by nothing else', () => {
    expect(hasUnsavedRetime({ kind: 'off' })).toBe(false);
    expect(hasUnsavedRetime(recording)).toBe(false);
    expect(hasUnsavedRetime(unsaved(0, 1))).toBe(true);
    expect(hasUnsavedRetime(unsaved(1, 0))).toBe(true);
  });
});
