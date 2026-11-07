import { describe, expect, it } from 'vitest';

import {
  retimeLineLabel,
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

describe('retimeLineLabel', () => {
  it('counts sung lines only', () => {
    expect(retimeLineLabel(lines, 0)).toBe('Line 1 of 3');
    expect(retimeLineLabel(lines, 2)).toBe('Line 2 of 3');
    expect(retimeLineLabel(lines, 3)).toBe('Line 3 of 3');
  });

  it('says when every line is tapped', () => {
    expect(retimeLineLabel(lines, -1)).toBe('All 3 lines tapped');
  });
});

describe('retimeSubtitle', () => {
  it('adds the speed the mixer plays', () => {
    expect(retimeSubtitle(lines, 0, 0.75)).toBe(
      'Line 1 of 3 · playing at 0.75×',
    );
    expect(retimeSubtitle(lines, -1, 0.75)).toBe(
      'All 3 lines tapped · playing at 0.75×',
    );
  });

  it('shows a song already slower at its own speed', () => {
    expect(retimeSubtitle(lines, 0, 0.6)).toBe('Line 1 of 3 · playing at 0.6×');
  });

  it('is the line alone while no speed is set', () => {
    expect(retimeSubtitle(lines, 0, null)).toBe('Line 1 of 3');
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
