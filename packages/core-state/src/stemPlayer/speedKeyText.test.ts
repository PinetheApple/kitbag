import { describe, expect, it } from 'vitest';

import { songFacts, type SongFacts } from './facts.ts';
import {
  keyHint,
  keyText,
  resetValue,
  speedHint,
  speedPercentText,
  speedPresetTexts,
  stemKeyStatus,
} from './speedKeyText.ts';

const SONG = {
  bpm: 123,
  key: 'F',
  scale: 'major',
  keyConfidence: 90,
  tempoStability: null,
};
const NO_SONG_FACTS: SongFacts = { bpm: null, key: null, tempo: null };
const RECORDED = songFacts(SONG);
const PLAYING = songFacts(SONG, { speed: 0.75, key: -2 });

describe('speed and key text', () => {
  it('reads speed as a percentage and key in signed semitones', () => {
    expect([speedPercentText(0.75), speedPercentText(1)]).toEqual([
      '75%',
      '100%',
    ]);
    expect([keyText(-2), keyText(0), keyText(3)]).toEqual([
      '−2 st',
      '0 st',
      '+3 st',
    ]);
    expect(resetValue()).toBe('100%, 0 st');
  });

  it('labels each preset and selects the one playing', () => {
    expect(speedPresetTexts(0.9)).toEqual([
      {
        value: 0.5,
        label: '50%',
        accessibilityLabel: 'Speed 50%',
        selected: false,
      },
      {
        value: 0.75,
        label: '75%',
        accessibilityLabel: 'Speed 75%',
        selected: false,
      },
      {
        value: 0.9,
        label: '90%',
        accessibilityLabel: 'Speed 90%',
        selected: true,
      },
      {
        value: 1,
        label: '100%',
        accessibilityLabel: 'Speed 100%',
        selected: false,
      },
    ]);
  });

  it('shows the song BPM and what plays', () => {
    expect(speedHint(RECORDED, RECORDED)).toBe('Song 123 BPM');
    expect(speedHint(RECORDED, PLAYING)).toBe('Song 123 BPM, plays at 92 BPM');
    expect(speedHint(NO_SONG_FACTS, NO_SONG_FACTS)).toBe(
      'No beat grid, so there is no BPM to show',
    );
  });

  it('shows the song key and what plays', () => {
    expect(keyHint(RECORDED, RECORDED, 0)).toBe(
      'F maj. Drums and the click are never transposed.',
    );
    expect(keyHint(RECORDED, PLAYING, -2)).toBe(
      'F maj plays as E♭ maj. Drums and the click are not transposed.',
    );
    expect(keyHint(NO_SONG_FACTS, NO_SONG_FACTS, -2)).toBe(
      'Drums and the click are not transposed.',
    );
  });

  it('says whether each stem follows the song key', () => {
    const rows = [
      { name: 'vocals', transposable: true, key: -2 },
      { name: 'drums', transposable: false, key: 0 },
      { name: 'bass', transposable: true, key: 0 },
    ];
    expect(rows.map((row) => stemKeyStatus(row, -2))).toEqual([
      'follows the song',
      'not transposed',
      'set apart',
    ]);
  });
});
