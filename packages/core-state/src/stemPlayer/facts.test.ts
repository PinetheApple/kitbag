import { describe, expect, it } from 'vitest';

import {
  CONFIDENT_KEY_MIN,
  shortKeyName,
  songFacts,
  STEADY_TEMPO_MIN,
  type SongFactsSource,
} from './facts.ts';

const FULL: SongFactsSource = {
  bpm: 122.6,
  key: 'F',
  scale: 'major',
  keyConfidence: 81,
  tempoStability: 96,
};

const NONE: SongFactsSource = {
  bpm: null,
  key: null,
  scale: null,
  keyConfidence: null,
  tempoStability: null,
};

describe('song facts', () => {
  it('shows the BPM, key and tempo stability and spells each out', () => {
    const { bpm, key, tempo } = songFacts(FULL);
    expect([bpm?.value, bpm?.unit, key?.text, tempo?.text]).toEqual([
      '123',
      'BPM',
      'F maj',
      'steady tempo',
    ]);
    expect([bpm?.spoken, key?.spoken, tempo?.spoken]).toEqual([
      '123 beats per minute',
      'key F major',
      'steady tempo',
    ]);
    expect(key?.muted).toBe(false);
  });

  it('carries no loudness, whatever the source holds', () => {
    const withLoudness = { ...FULL, loudnessLufs: -9.34 };
    const facts = songFacts(withLoudness);
    expect(Object.keys(facts).sort()).toEqual(['bpm', 'key', 'tempo']);
    expect(JSON.stringify(facts)).not.toMatch(/LUFS|loudness/);
  });

  it('leaves out each missing field rather than showing a placeholder', () => {
    expect(songFacts(NONE)).toEqual({ bpm: null, key: null, tempo: null });
    expect(songFacts({ ...FULL, scale: null }).key?.text).toBe('F');
  });

  it('words the tempo stability around its threshold', () => {
    const at = (tempoStability: number) =>
      songFacts({ ...NONE, tempoStability }).tempo?.text;
    expect(at(STEADY_TEMPO_MIN)).toBe('steady tempo');
    expect(at(STEADY_TEMPO_MIN - 1)).toBe('variable tempo');
  });

  it('mutes a key the analysis was unsure of and says so', () => {
    const { key } = songFacts({
      ...FULL,
      keyConfidence: CONFIDENT_KEY_MIN - 1,
    });
    expect(key?.muted).toBe(true);
    expect(key?.spoken).toBe('key F major, uncertain');
  });

  it('reads the mode once when the key already carries it', () => {
    const { key } = songFacts({ ...NONE, key: 'F maj', scale: 'Major' });
    expect([key?.text, key?.spoken]).toEqual(['F maj', 'key F major']);
    expect(shortKeyName('A min', null)).toBe('A min');
  });

  it('abbreviates the scale for a badge', () => {
    expect(shortKeyName('F', 'major')).toBe('F maj');
    expect(shortKeyName('C#', 'minor')).toBe('C# min');
    expect(shortKeyName('D', 'dorian')).toBe('D dorian');
    expect(shortKeyName('D', null)).toBe('D');
    expect(shortKeyName(null, 'minor')).toBe(null);
  });
});
