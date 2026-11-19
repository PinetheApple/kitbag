import { songFacts, type SongFacts } from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import {
  keyHint,
  keyText,
  perStemSummary,
  resetValue,
  speedHint,
  speedText,
  spokenKey,
  stemKeyStatus,
} from './speedKeyView.ts';

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
const vocals = { name: 'vocals', transposable: true, key: -2 };
const drums = { name: 'drums', transposable: false, key: 0 };
const bass = { name: 'bass', transposable: true, key: 0 };

describe('speed and key text', () => {
  it('reads speed as a percentage and key in signed semitones', () => {
    expect([speedText(0.75), speedText(1)]).toEqual(['75%', '100%']);
    expect([keyText(-2), keyText(0), keyText(3)]).toEqual([
      '−2 st',
      '0 st',
      '+3 st',
    ]);
    expect([spokenKey(-2), spokenKey(1), spokenKey(0)]).toEqual([
      'down 2 semitones',
      'up 1 semitone',
      'as recorded',
    ]);
    expect(resetValue()).toBe('100%, 0 st');
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

  it('names the stems set apart from the song key', () => {
    expect(perStemSummary([vocals, drums], -2)).toBe('all follow the song');
    expect(perStemSummary([vocals, drums, bass], -2)).toBe('bass set apart');
    expect(perStemSummary([vocals, drums, bass], 3)).toBe('2 stems set apart');
    expect([vocals, drums, bass].map((row) => stemKeyStatus(row, -2))).toEqual([
      'follows the song',
      'not transposed',
      'set apart',
    ]);
  });
});
