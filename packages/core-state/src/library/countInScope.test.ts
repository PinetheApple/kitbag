import {
  KB_COUNT_IN_BARS,
  KB_COUNT_IN_OFF,
  type KbCountInBars,
} from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import { COUNT_IN_SCOPE } from '../metronome/countInScope.ts';
import { isLoadedSongUnsaved } from './presetMapping.ts';
import { SONG_STEP } from './setlistPosition.ts';
import { setup } from './store.test-helper.ts';

const [, ONE_BAR, TWO_BARS, FOUR_BARS] = KB_COUNT_IN_BARS;
const LIVE_SOUND = 5;

async function songs(bars: readonly KbCountInBars[]) {
  const fixture = setup();
  const s = fixture.library.getState();
  const gig = await s.createSetlist('Gig');
  for (const [index, count] of bars.entries()) {
    fixture.metronome
      .getState()
      .setCountIn({ ...fixture.metronome.getState().countIn, bars: count });
    await s.newSongFromCurrent(`Song ${String(index)}`, gig);
  }
  const entries = fixture.library.getState().entries[gig] ?? [];
  const load = (index: number) => {
    const entry = entries[index];
    if (entry === undefined) throw new Error('missing song');
    return fixture.library
      .getState()
      .loadSong(entry.preset.id, entry.item.id, gig);
  };
  return { ...fixture, entries, load };
}

describe('count-in per song', () => {
  it('loads each song its own count-in, and none for a song without one', async () => {
    const { metronome, load, commands } = await songs([
      TWO_BARS,
      KB_COUNT_IN_OFF,
    ]);
    metronome
      .getState()
      .setCountIn({ ...metronome.getState().countIn, bars: FOUR_BARS });
    await load(0);
    expect(metronome.getState().countIn.bars).toBe(TWO_BARS);
    await load(1);
    expect(metronome.getState().countIn.bars).toBe(KB_COUNT_IN_OFF);
    expect(commands.setCountIn).toHaveBeenLastCalledWith(
      KB_COUNT_IN_OFF,
      expect.any(Boolean),
      expect.any(Number),
    );
  });
});

describe('count-in on every song', () => {
  async function always() {
    const fixture = await songs([TWO_BARS, ONE_BAR, KB_COUNT_IN_OFF]);
    const m = fixture.metronome.getState();
    m.setCountInScope(COUNT_IN_SCOPE.always);
    m.setCountIn({ bars: FOUR_BARS, distinct: false, sound: LIVE_SOUND });
    fixture.commands.setCountIn.mockClear();
    return fixture;
  }
  const kept = { bars: FOUR_BARS, distinct: false, sound: LIVE_SOUND };

  it('keeps the live count-in through a load, setlist steps and Revert', async () => {
    const { metronome, library, load, commands } = await always();
    await load(0);
    expect(metronome.getState().countIn).toEqual(kept);
    await library.getState().stepSong(SONG_STEP.next);
    expect(metronome.getState().countIn).toEqual(kept);
    await library.getState().stepSong(SONG_STEP.next);
    await library.getState().stepSong(SONG_STEP.previous);
    expect(metronome.getState().countIn).toEqual(kept);
    library.getState().revertLoadedSong();
    expect(metronome.getState().countIn).toEqual(kept);
    expect(commands.setCountIn).not.toHaveBeenCalled();
  });

  it('does not mark a loaded song unsaved for the shared count-in', async () => {
    const { metronome, library, load } = await always();
    await load(0);
    const preset = library
      .getState()
      .presets.find((p) => p.id === library.getState().loaded?.presetId);
    if (preset === undefined) throw new Error('missing song');
    expect(isLoadedSongUnsaved(preset, metronome.getState())).toBe(false);
  });

  it('a new song from current takes the live count-in as its own', async () => {
    const { metronome, library } = await always();
    const id = await library.getState().newSongFromCurrent('New');
    const created = library.getState().presets.find((p) => p.id === id);
    expect(created?.countInBars).toBe(FOUR_BARS);
    metronome.getState().setCountInScope(COUNT_IN_SCOPE.perSong);
    metronome
      .getState()
      .setCountIn({ ...metronome.getState().countIn, bars: ONE_BAR });
    await library.getState().loadSong(id);
    expect(metronome.getState().countIn.bars).toBe(FOUR_BARS);
  });

  it('saving a song keeps the song its own count-in', async () => {
    const { metronome, library, load, entries } = await always();
    await load(0);
    metronome.getState().setTempo(metronome.getState().bpm + 1);
    await library.getState().saveLoadedSong();
    const saved = library
      .getState()
      .presets.find((p) => p.id === entries[0]?.preset.id);
    expect(saved?.countInBars).toBe(TWO_BARS);
    metronome.getState().setCountInScope(COUNT_IN_SCOPE.perSong);
    await load(0);
    expect(metronome.getState().countIn.bars).toBe(TWO_BARS);
  });
});
