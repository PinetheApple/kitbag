import { KB_ACCENT } from '@kitbag/core-native';
import type { SongPreset } from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import {
  draftFrom,
  editFrom,
  withBeats,
  withCycledAccent,
  withCycledPolyAccent,
  withNextDenominator,
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
  sound: 1,
  rampEnabled: true,
  rampStartBpm: 96,
  rampEndBpm: 104,
  rampBars: 8,
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
      rampBars: 8,
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

  it('never saves an empty name or blank notes', () => {
    const edit = editFrom({ ...draftFrom(PRESET), name: '  ', notes: ' ' });
    expect(edit.name).toBe('Untitled');
    expect(edit.notes).toBeNull();
  });
});

describe('row subtitles', () => {
  it('reads the preset at a glance as the design does', () => {
    expect(songSubtitle(PRESET)).toBe('96 · 3/4 · ⛰ 96→104');
    expect(songSubtitle({ ...PRESET, rampEnabled: false })).toBe(
      '96 · 3/4 · ✎ notes',
    );
    expect(songSubtitle({ ...PRESET, rampEnabled: false, notes: null })).toBe(
      '96 · 3/4 · ⏱ 1 bar',
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
