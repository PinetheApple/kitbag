import { chosenTypedBpm, stepped } from '@kitbag/core-design';
import { describe, expect, it } from 'vitest';

import {
  offerAction,
  offerText,
  reanalyseBody,
  SONG_SET_TEMPO,
  usingAnalysedText,
} from './manualTempoText.ts';

const { rules, text } = SONG_SET_TEMPO;
const MANUAL = { bpm: 128, anchor: 2.3, beatsPerBar: 4 } as const;
const typed = (digits: string) => ({ digits, untouched: false });

describe('the song player tempo rules', () => {
  it('clamps a typed tempo to 30 – 300 BPM', () => {
    expect(chosenTypedBpm(typed('412'), null, rules)).toBe(300);
    expect(chosenTypedBpm(typed('12'), null, rules)).toBe(30);
    expect(text.typedHint(412).text).toBe('Above 300 BPM. Saves as 300.');
  });

  it('steps and shows the tempo by a tenth', () => {
    const draft = { ...MANUAL, nudgedMs: 0 };
    expect(stepped(draft, 1, rules).bpm).toBe(128.1);
    expect(text.slower).toBe('Tempo 0.1 BPM slower');
    expect(text.bpmText(127.64)).toBe('127.6 BPM');
  });
});

describe('re-analysis copy', () => {
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

  it('says when the analysed tempo is back in use', () => {
    expect(usingAnalysedText(132)).toBe('Back to the analysed tempo: 132 BPM.');
  });
});
