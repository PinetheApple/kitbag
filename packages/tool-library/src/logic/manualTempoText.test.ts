import { describe, expect, it } from 'vitest';

import {
  bpmText,
  nudgedText,
  nudgeLabel,
  offerAction,
  offerText,
  reanalyseBody,
  savedText,
  SET_TEMPO_TEXT,
  tappedHint,
  typedHint,
  wasAnalysedText,
} from './manualTempoText.ts';

const MANUAL = { bpm: 128, anchor: 2.3, beatsPerBar: 4 } as const;

describe('manual tempo copy', () => {
  it('shows a whole tempo bare and a tapped one to a tenth', () => {
    expect(bpmText(128)).toBe('128 BPM');
    expect(bpmText(127.64)).toBe('127.6 BPM');
  });

  it('names the stepper keys by the step they take', () => {
    expect(SET_TEMPO_TEXT.slower).toBe('Tempo 0.1 BPM slower');
    expect(SET_TEMPO_TEXT.faster).toBe('Tempo 0.1 BPM faster');
  });

  it('repeats what was saved', () => {
    expect(savedText(MANUAL)).toBe('Tempo set: 128 BPM, bar 1 at 0:02.3.');
  });

  it('names the analysed tempo it was prefilled with', () => {
    expect(wasAnalysedText(132)).toBe('was 132 from analysis');
  });

  it('offers a newer analysed tempo without replacing the manual one', () => {
    expect(offerText(132)).toBe(
      'Analysis found 132 BPM. Your manual tempo is still in use.',
    );
    expect(offerAction(132)).toBe('Use 132');
  });

  it('says what re-analysis does to the manual tempo before it starts', () => {
    expect(reanalyseBody(MANUAL)).toBe(
      'Your manual tempo, 128 BPM with bar 1 at 0:02.3, stays in use. If analysis finds a beat, you choose which to keep.',
    );
  });
});

describe('typedHint', () => {
  it('shows the range while the typed tempo is inside it', () => {
    expect(typedHint(128)).toEqual({ text: '30 – 300 BPM', tone: 'plain' });
    expect(typedHint(undefined)).toEqual({
      text: '30 – 300 BPM',
      tone: 'plain',
    });
  });

  it('names the clamped value above and below the range', () => {
    expect(typedHint(412)).toEqual({
      text: 'Above 300 BPM. Saves as 300.',
      tone: 'warning',
    });
    expect(typedHint(12)).toEqual({
      text: 'Below 30 BPM. Saves as 30.',
      tone: 'warning',
    });
  });
});

describe('tap and nudge copy', () => {
  it('counts the taps behind a settled tempo', () => {
    expect(tappedHint(9)).toBe('From 9 taps. Keep tapping to refine.');
  });

  it('signs a nudge with a true minus', () => {
    expect(nudgeLabel(-10)).toBe('−10 ms');
    expect(nudgeLabel(10)).toBe('+10 ms');
    expect(nudgedText(20)).toBe(
      'Moved +20 ms. Playing with the click: check late in the song for drift.',
    );
  });
});
