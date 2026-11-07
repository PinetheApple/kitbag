import { describe, expect, it } from 'vitest';

import {
  isSectionLoop,
  loopNoteText,
  sectionBoundaryFractions,
  sectionCardWidth,
  sectionProgress,
  sectionRange,
  undoMessage,
} from './sectionView.ts';

const verse = {
  name: 'Verse 2',
  kind: '',
  color: '',
  startSec: 72,
  endSec: 104,
};
const chorus = {
  name: 'Chorus',
  kind: '',
  color: '',
  startSec: 104,
  endSec: 136,
};
const DURATION = 311;

describe('sectionRange', () => {
  it('draws the range the card shows', () => {
    expect(sectionRange(verse)).toBe('1:12–1:44');
  });
});

describe('sectionBoundaryFractions', () => {
  it('gives one notch per distinct boundary inside the song', () => {
    expect(sectionBoundaryFractions([verse, chorus], DURATION)).toEqual([
      72 / DURATION,
      104 / DURATION,
      136 / DURATION,
    ]);
  });

  it('draws no notch on the song ends', () => {
    const whole = { ...verse, startSec: 0, endSec: DURATION };
    expect(sectionBoundaryFractions([whole], DURATION)).toEqual([]);
  });

  it('draws nothing before the duration is known', () => {
    expect(sectionBoundaryFractions([verse], 0)).toEqual([]);
  });
});

describe('sectionProgress', () => {
  it('runs from 0 at the start to 1 at the end, and stays there', () => {
    expect(sectionProgress(72, verse)).toBe(0);
    expect(sectionProgress(88, verse)).toBe(0.5);
    expect(sectionProgress(200, verse)).toBe(1);
    expect(sectionProgress(10, verse)).toBe(0);
  });
});

describe('isSectionLoop', () => {
  const on = (startSec: number, endSec: number) =>
    ({ kind: 'on', startSec, endSec }) as const;

  it('recognises a loop over the section despite frame rounding', () => {
    expect(isSectionLoop(on(72, 104.00001), verse, DURATION)).toBe(true);
  });

  it('recognises a section loop the song end cut short', () => {
    const last = { ...verse, endSec: DURATION + 5 };
    expect(isSectionLoop(on(72, DURATION), last, DURATION)).toBe(true);
  });

  it('refuses a custom loop that merely starts on the section', () => {
    expect(isSectionLoop(on(72, 90), verse, DURATION)).toBe(false);
  });

  it('refuses an armed or absent loop', () => {
    expect(isSectionLoop({ kind: 'off' }, verse, DURATION)).toBe(false);
    expect(
      isSectionLoop({ kind: 'armed', startSec: 72 }, verse, DURATION),
    ).toBe(false);
  });
});

describe('loopNoteText', () => {
  it('names the section a loop covers', () => {
    expect(
      loopNoteText(
        { kind: 'on', startSec: 72, endSec: 104 },
        [chorus, verse],
        DURATION,
      ),
    ).toBe('Verse 2 · 1:12 – 1:44');
  });

  it('keeps the plain note for a custom loop and an armed one', () => {
    expect(
      loopNoteText({ kind: 'on', startSec: 72, endSec: 90 }, [verse], DURATION),
    ).toBe('Loop 1:12 – 1:30');
    expect(
      loopNoteText({ kind: 'armed', startSec: 72 }, [verse], DURATION),
    ).toBe('Loop from 1:12');
  });

  it('has no note with no loop', () => {
    expect(loopNoteText({ kind: 'off' }, [verse], DURATION)).toBeNull();
  });
});

describe('undoMessage', () => {
  it('says what happened to the loop', () => {
    expect(undoMessage({ kind: 'on', startSec: 1, endSec: 2 })).toBe(
      'Loop replaced',
    );
    expect(undoMessage({ kind: 'off' })).toBe('Loop cleared');
  });
});

describe('sectionCardWidth', () => {
  it('is the drawn width at the default text size', () => {
    expect(sectionCardWidth(1)).toBe(152);
  });

  it('never narrows the card when the text shrinks', () => {
    expect(sectionCardWidth(0.85)).toBe(152);
  });

  it('grows only the room the text uses, so a range fits at 2.0', () => {
    expect(sectionCardWidth(2)).toBe(244);
  });
});
