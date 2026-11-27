import { BPM_SOURCE } from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import {
  SET_TEMPO_HINT,
  shownBpm,
  tempoLine,
  type TempoLine,
} from './tempoLine.ts';

const text = (line: TempoLine) => line.lead + line.rung + line.tail;

const NO_LOOKUP = { bpm: null, source: null, tried: [], looking: false };
const SONG_BPM = 171;

describe('tempoLine', () => {
  it('names the library beat grid while the grid is offered', () => {
    const line = tempoLine({
      ...NO_LOOKUP,
      bpm: SONG_BPM,
      source: BPM_SOURCE.library,
      offered: true,
    });
    expect(text(line)).toBe('from your library beat grid');
    expect(line.rung).toBe('library');
  });

  it('keeps a typed tempo named while the grid is offered', () => {
    const typed = { ...NO_LOOKUP, bpm: SONG_BPM, source: BPM_SOURCE.manual };
    expect(tempoLine({ ...typed, offered: true })).toEqual(tempoLine(typed));
  });

  it('names the library as the rung that found the tempo', () => {
    const line = tempoLine({
      ...NO_LOOKUP,
      bpm: SONG_BPM,
      source: BPM_SOURCE.library,
      tried: [BPM_SOURCE.library],
    });
    expect(text(line)).toBe('via your library · tap to change');
    expect(line.rung).toBe('your library');
    expect(line.credit).toBeNull();
  });

  it('credits GetSongBPM with a link whenever it answered', () => {
    const line = tempoLine({
      ...NO_LOOKUP,
      bpm: SONG_BPM,
      source: BPM_SOURCE.getSongBpm,
    });
    expect(text(line)).toBe('via GetSongBPM · tap to change');
    expect(line.credit?.url).toBe('https://getsongbpm.com');
  });

  it('says a tapped tempo came from tap tempo', () => {
    const line = tempoLine({
      ...NO_LOOKUP,
      bpm: SONG_BPM,
      source: BPM_SOURCE.tap,
    });
    expect(text(line)).toBe('from tap tempo · tap to change');
  });

  it('names every rung tried when all of them failed', () => {
    const line = tempoLine({
      ...NO_LOOKUP,
      tried: [BPM_SOURCE.library, BPM_SOURCE.getSongBpm],
    });
    expect(text(line)).toBe('Not found · library, GetSongBPM');
    expect(line.noTempo).toBe(true);
  });

  it('asks for a tempo while nothing has been tried yet', () => {
    const line = tempoLine(NO_LOOKUP);
    expect(text(line)).toBe(SET_TEMPO_HINT);
    expect(line.noTempo).toBe(false);
  });

  it('says the lookup is running instead of reporting a failure', () => {
    const line = tempoLine({
      ...NO_LOOKUP,
      tried: [BPM_SOURCE.library],
      looking: true,
    });
    expect(text(line)).toBe('Looking up · library');
    expect(line.noTempo).toBe(false);
  });

  it('names only the library when that was the one rung tried', () => {
    const line = tempoLine({ ...NO_LOOKUP, tried: [BPM_SOURCE.library] });
    expect(text(line)).toBe('Not found · library');
  });
});

describe('shownBpm', () => {
  it('rounds an analysed or halved tempo for display', () => {
    expect(shownBpm(85.5)).toBe('86');
    expect(shownBpm(171.4)).toBe('171');
  });
});
