import { KB_ACCENT } from '@kitbag/core-native';
import { SAVE_REFUSAL, type PlayAlongPattern } from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import {
  accentsValue,
  recallLine,
  SAVE_REFUSAL_TEXT,
  saveRows,
  trackLabel,
} from './saveForSong.ts';

const { KB_ACCENT_ACCENTED: ACC, KB_ACCENT_NORMAL: NORM } = KB_ACCENT;
const WOODBLOCK = 1;
const NUDGE_MS = 10;
const EIGHTHS = 2;
const EDGE_PHASE_MS = 30000 / 171;

const pattern: PlayAlongPattern = {
  beatsPerBar: 4,
  denominator: 4,
  subdivision: 1,
  accents: [ACC, NORM, NORM, NORM],
  sounds: { normal: WOODBLOCK, accent: WOODBLOCK },
  volume: 1,
};

const track = {
  title: 'Blinding Lights',
  artist: 'The Weeknd',
  durationMs: 200_000,
};

describe('saveRows', () => {
  it('lists the saved fields the design draws, in its order', () => {
    expect(saveRows(pattern, track, NUDGE_MS)).toEqual([
      { label: 'Track', value: 'Blinding Lights · The Weeknd' },
      { label: 'Meter', value: '4/4' },
      { label: 'Subdivision', value: 'Quarters' },
      { label: 'Accents', value: 'Beat 1' },
      { label: 'Sound', value: 'Woodblock' },
      { label: 'Phase nudge', value: '+10 ms' },
    ]);
  });

  it('reads a phase at the D5 limit as whole ms', () => {
    const rows = saveRows(pattern, track, EDGE_PHASE_MS);
    expect(rows.at(-1)?.value).toBe('+175 ms');
  });
});

describe('accentsValue', () => {
  it('names every accented beat', () => {
    expect(accentsValue([ACC, NORM, ACC, NORM])).toBe('Beats 1, 3');
  });

  it('says none when no beat is accented', () => {
    expect(accentsValue([NORM, NORM])).toBe('None');
  });
});

describe('trackLabel', () => {
  it('drops a missing artist', () => {
    expect(trackLabel({ ...track, artist: null })).toBe('Blinding Lights');
  });
});

describe('recallLine', () => {
  it('names the recalled meter, subdivision and sound', () => {
    expect(recallLine({ ...pattern, subdivision: EIGHTHS })).toBe(
      'Your saved settings are back: 4/4, eighths, Woodblock',
    );
  });
});

it('has words for every save refusal', () => {
  for (const reason of Object.values(SAVE_REFUSAL))
    expect(SAVE_REFUSAL_TEXT[reason]).toMatch(/\w/);
});
