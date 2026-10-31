import {
  KB_ACCENT,
  KB_POLY_AGAINST_BAR,
  KB_RAMP_UNIT,
} from '@kitbag/core-native';
import type { SongPreset } from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import { withRampUnit } from './rampUnit.ts';
import {
  draftFrom,
  editFrom,
  withBeats,
  withCycledAccent,
  withCycledPolyAccent,
  withNextDenominator,
  withPolyAgainst,
  withPolyBeats,
} from './presetDraft.ts';
import { setlistSubtitle, songSubtitle } from './songSummary.ts';

const {
  KB_ACCENT_ACCENTED: A,
  KB_ACCENT_NORMAL: N,
  KB_ACCENT_MUTED: M,
} = KB_ACCENT;

const PRESET = {
  id: 1,
  uuid: 'u',
  name: 'Blackbird',
  bpm: 96,
  beatsPerBar: 3,
  denominator: 4,
  subdivision: 2,
  accents: Uint8Array.from([A, N, N]),
  perAccentSounds: null,
  polyAccents: Uint8Array.from([A, N, M]),
  polyEnabled: false,
  polyBeats: 0,
  polyAgainst: 2,
  sound: 1,
  rampEnabled: true,
  rampStartBpm: 96,
  rampEndBpm: 104,
  rampLength: 90,
  rampUnit: 1,
  rampLoop: true,
  barMuteEnabled: false,
  barMutePlayBars: null,
  barMuteMuteBars: null,
  countInBars: 1,
  notes: 'Fingerstyle — count 3',
  phaseNudge: 0,
  title: null,
  artist: null,
  source: null,
  lengthSeconds: null,
  librarySongId: null,
} as unknown as SongPreset;

describe('preset draft', () => {
  it('round-trips every editable field', () => {
    const edit = editFrom(draftFrom(PRESET));
    expect(edit).toMatchObject({
      name: 'Blackbird',
      notes: 'Fingerstyle — count 3',
      bpm: 96,
      beatsPerBar: 3,
      rampEnabled: true,
      rampEndBpm: 104,
      rampLength: 90,
      rampUnit: 1,
      rampLoop: true,
      countInBars: 1,
      sound: 1,
    });
    expect(Array.from(edit.accents ?? [])).toEqual([A, N, N]);
    expect(Array.from(edit.polyAccents ?? [])).toEqual([A, N, M]);
  });

  it('resizes accents with each meter and cycles both LED rows', () => {
    const four = withBeats(draftFrom(PRESET), 1);
    expect(four.accents).toEqual([A, N, N, N]);
    expect(withCycledAccent(four, 1).accents).toEqual([A, M, N, N]);
    expect(withCycledAccent(four, 0).accents[0]).toBe(N);
    const polyFour = withPolyBeats(four, 1);
    expect(polyFour.polyAccents).toEqual([A, N, M, N]);
    expect(withCycledPolyAccent(polyFour, 2).polyAccents).toEqual([A, N, A, N]);
    expect(withNextDenominator(four).denominator).toBe(8);
  });

  it('saves the poly cycle and steps it through the bar', () => {
    const draft = draftFrom(PRESET);
    expect(draft.polyAgainst).toBe(2);
    expect(editFrom(draft).polyAgainst).toBe(2);
    const bar = withPolyAgainst(draft, 1);
    expect(bar.polyAgainst).toBe(KB_POLY_AGAINST_BAR);
    expect(editFrom(bar).polyAgainst).toBe(KB_POLY_AGAINST_BAR);
    expect(withPolyAgainst(bar, 1).polyAgainst).toBe(4);
  });

  it('turns an explicit poly cycle into the bar when the meter comes to equal it', () => {
    const draft = draftFrom({ ...PRESET, polyAgainst: 4 });
    expect(withBeats(draft, 1).polyAgainst).toBe(KB_POLY_AGAINST_BAR);
    expect(withBeats(draft, -1).polyAgainst).toBe(4);
  });

  it('reads a stored count equal to the bar as the bar', () => {
    expect(draftFrom({ ...PRESET, polyAgainst: 3 }).polyAgainst).toBe(
      KB_POLY_AGAINST_BAR,
    );
  });

  it('reads a stored count the engine cannot hold as the bar', () => {
    expect(draftFrom({ ...PRESET, polyAgainst: 99 }).polyAgainst).toBe(
      KB_POLY_AGAINST_BAR,
    );
  });

  it('keeps a ramp unit change through save and reload', () => {
    const draft = draftFrom(PRESET);
    const edited = {
      ...draft,
      ramp: withRampUnit(
        { ...draft.ramp, interval: 3 },
        KB_RAMP_UNIT.KB_RAMP_MINUTES,
      ),
    };
    const reloaded = draftFrom({
      ...PRESET,
      ...editFrom(edited),
    } as SongPreset);
    expect(reloaded.ramp).toEqual({
      ...draft.ramp,
      interval: 3,
      unit: KB_RAMP_UNIT.KB_RAMP_MINUTES,
    });
  });

  it('never saves an empty name or blank notes', () => {
    const edit = editFrom({ ...draftFrom(PRESET), name: '  ', notes: ' ' });
    expect(edit.name).toBe('Untitled');
    expect(edit.notes).toBeNull();
  });
});

describe('row subtitles', () => {
  it('reads the preset at a glance as the design does', () => {
    expect(songSubtitle(PRESET)).toBe('96 · 3/4 · ramp 96→104');
    expect(songSubtitle({ ...PRESET, rampEnabled: false })).toBe(
      '96 · 3/4 · notes',
    );
    expect(songSubtitle({ ...PRESET, rampEnabled: false, notes: null })).toBe(
      '96 · 3/4 · count-in 1 bar',
    );
    expect(
      songSubtitle({
        ...PRESET,
        rampEnabled: false,
        notes: null,
        countInBars: 0,
      }),
    ).toBe('96 · 3/4 · Woodblock');
  });

  it('names played songs only for the set on stage', () => {
    expect(setlistSubtitle(12, 0, 3)).toBe('12 songs · 3 played tonight');
    expect(setlistSubtitle(4, 3, undefined)).toBe('4 songs · ramp on 3');
    expect(setlistSubtitle(1, 0, undefined)).toBe('1 song');
  });
});
