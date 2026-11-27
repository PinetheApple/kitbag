import {
  KB_ACCENT,
  KB_POLY_AGAINST_BAR,
  KB_RAMP_UNIT,
} from '@kitbag/core-native';
import { DEFAULT_BPM, type SongPreset } from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import { songPreset } from './fixtures.test-helper.ts';
import { withRampUnit } from './rampUnit.ts';
import {
  draftFrom,
  editFrom,
  keepsSongTempo,
  withBeats,
  withCycledAccent,
  withCycledPolyAccent,
  withNextDenominator,
  withPolyAgainst,
  withPolyBeats,
  withRampBpmEdited,
  withTempoEdited,
} from './presetDraft.ts';
import { setlistSubtitle, songSubtitle } from './songSummary.ts';

const {
  KB_ACCENT_ACCENTED: A,
  KB_ACCENT_NORMAL: N,
  KB_ACCENT_MUTED: M,
} = KB_ACCENT;

const PRESET = songPreset();

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

  it('starts a song that saves no tempo at the default tempo', () => {
    const draft = draftFrom({
      ...PRESET,
      bpm: null,
      rampStartBpm: null,
      rampEndBpm: null,
    });
    expect(draft.bpm).toBe(DEFAULT_BPM);
    expect(draft.ramp).toMatchObject({
      startBpm: DEFAULT_BPM,
      targetBpm: DEFAULT_BPM,
    });
  });

  it('saves no tempo for a song that has none unless the tempo is changed', () => {
    const draft = draftFrom({ ...PRESET, bpm: null });
    expect(editFrom(draft).bpm).toBeNull();
    const changed = withTempoEdited({ ...draft, bpm: draft.bpm + 1 });
    expect(editFrom(changed).bpm).toBe(DEFAULT_BPM + 1);
  });

  it('keeps the song’s tempo until the tempo is edited, even back to the same number', () => {
    const draft = draftFrom({ ...PRESET, bpm: null });
    expect(keepsSongTempo(draft)).toBe(true);
    const back = withTempoEdited(draft);
    expect(keepsSongTempo(back)).toBe(false);
    expect(editFrom(back).bpm).toBe(DEFAULT_BPM);
    expect(keepsSongTempo(draftFrom({ ...PRESET, bpm: DEFAULT_BPM }))).toBe(
      false,
    );
  });

  describe('a ramp that follows the song’s tempo', () => {
    const following = draftFrom({
      ...PRESET,
      bpm: null,
      rampStartBpm: null,
      rampEndBpm: null,
    });

    it('saves no ramp tempos while the song’s tempo is kept', () => {
      expect(editFrom(following)).toMatchObject({
        rampStartBpm: null,
        rampEndBpm: null,
      });
    });

    it('saves the ramp tempo that was edited and keeps the other following', () => {
      const edited = withRampBpmEdited(following, 'startBpm');
      expect(editFrom(edited)).toMatchObject({
        rampStartBpm: DEFAULT_BPM,
        rampEndBpm: null,
      });
    });

    it('saves both ramp tempos once the tempo is set', () => {
      expect(editFrom(withTempoEdited(following))).toMatchObject({
        rampStartBpm: DEFAULT_BPM,
        rampEndBpm: DEFAULT_BPM,
      });
    });

    it('keeps saving a set ramp as before', () => {
      const set = draftFrom({ ...PRESET, bpm: null });
      expect(editFrom(set)).toMatchObject({
        rampStartBpm: PRESET.rampStartBpm,
        rampEndBpm: PRESET.rampEndBpm,
      });
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

  it('reads the tempo as the song’s for a song that saves none', () => {
    const untimed = { ...PRESET, bpm: null, notes: null, countInBars: 0 };
    expect(songSubtitle({ ...untimed, rampEnabled: false })).toBe(
      'Tempo from the song · 3/4 · Woodblock',
    );
    expect(songSubtitle({ ...untimed, rampStartBpm: null })).toBe(
      'Tempo from the song · 3/4 · Woodblock',
    );
  });

  it('names played songs only for the set on stage', () => {
    expect(setlistSubtitle(12, 0, 3)).toBe('12 songs · 3 played tonight');
    expect(setlistSubtitle(4, 3, undefined)).toBe('4 songs · ramp on 3');
    expect(setlistSubtitle(1, 0, undefined)).toBe('1 song');
  });
});
