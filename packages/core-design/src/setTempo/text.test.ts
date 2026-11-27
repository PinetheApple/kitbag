import { describe, expect, it } from 'vitest';

import { RULES } from './rules.test-helper.ts';
import { setTempoText } from './text.ts';

const {
  bpmText,
  faster,
  nudgedText,
  nudgeLabel,
  savedText,
  slower,
  tappedHint,
  typedHint,
  wasAnalysedText,
} = setTempoText(RULES);

const MANUAL = { bpm: 128, anchor: 2.3 };

describe('set tempo copy', () => {
  it('shows a whole tempo bare and a fractional one as the rules round it', () => {
    expect(bpmText(128)).toBe('128 BPM');
    expect(bpmText(127.64)).toBe('127.5 BPM');
  });

  it('names the stepper keys by the step the rules take', () => {
    expect(slower).toBe('Tempo 0.5 BPM slower');
    expect(faster).toBe('Tempo 0.5 BPM faster');
  });

  it('repeats what was saved', () => {
    expect(savedText(MANUAL)).toBe('Tempo set: 128 BPM, bar 1 at 0:02.3.');
  });

  it('names the analysed tempo it was prefilled with', () => {
    expect(wasAnalysedText(132)).toBe('was 132 from analysis');
  });
});

describe('typedHint', () => {
  it('shows the rules range while the typed tempo is inside it', () => {
    expect(typedHint(128)).toEqual({ text: '40 – 240 BPM', tone: 'plain' });
    expect(typedHint(undefined)).toEqual({
      text: '40 – 240 BPM',
      tone: 'plain',
    });
  });

  it('names the clamped value above and below the range', () => {
    expect(typedHint(412)).toEqual({
      text: 'Above 240 BPM. Saves as 240.',
      tone: 'warning',
    });
    expect(typedHint(12)).toEqual({
      text: 'Below 40 BPM. Saves as 40.',
      tone: 'warning',
    });
  });
});

describe('tap and nudge copy', () => {
  it('counts the taps behind a settled tempo', () => {
    expect(tappedHint(9)).toBe('From 9 taps. Keep tapping to refine.');
  });

  it('signs a nudge with the rules minus', () => {
    expect(nudgeLabel(-10)).toBe('−10 ms');
    expect(nudgeLabel(10)).toBe('+10 ms');
    expect(nudgedText(20, true)).toBe(
      'Moved +20 ms. Playing with the click: check late in the song for drift.',
    );
  });

  it('asks for a drift check only while the click plays', () => {
    expect(nudgedText(20, false)).toBe('Moved +20 ms.');
  });
});
