import { KB_POLY_AGAINST_BAR } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import { applyPreset, presetFromMetronome, toBlob } from './presetMapping.ts';
import { setup } from './store.test-helper.ts';

describe('poly cycle through save and load', () => {
  it('saves the poly cycle with a song and sends it back on load', async () => {
    const { library, metronome, commands } = setup();
    const s = library.getState();
    metronome.getState().setPoly(true, 3);
    metronome.getState().setPolyAgainst(2);
    const explicit = await s.newSongFromCurrent('Three against two');
    metronome.getState().setPolyAgainst(KB_POLY_AGAINST_BAR);
    const bar = await s.newSongFromCurrent('Three against the bar');
    await s.loadSong(explicit);
    expect(metronome.getState().polyAgainst).toBe(2);
    expect(commands.setPolyAgainst).toHaveBeenLastCalledWith(2);
    await s.loadSong(bar);
    expect(metronome.getState().polyAgainst).toBe(KB_POLY_AGAINST_BAR);
    expect(commands.setPolyAgainst).toHaveBeenLastCalledWith(
      KB_POLY_AGAINST_BAR,
    );
  });

  it('loads a stored count equal to the song meter as the bar', async () => {
    const { metronome, repos } = setup();
    const song = await repos.presets.create({
      ...presetFromMetronome(metronome.getState()),
      name: 'Waltz',
      beatsPerBar: 3,
      accents: toBlob([1, 1, 1]),
    });
    applyPreset({ ...song, polyAgainst: 3 }, () => metronome.getState());
    expect(metronome.getState().polyAgainst).toBe(KB_POLY_AGAINST_BAR);
  });

  it('applies the meter before the poly cycle on load', async () => {
    const { library, metronome, commands } = setup();
    const s = library.getState();
    metronome.getState().setPolyAgainst(2);
    const song = await s.newSongFromCurrent('Order');
    commands.setBeats.mockClear();
    commands.setPolyAgainst.mockClear();
    await s.loadSong(song);
    const [beats] = commands.setBeats.mock.invocationCallOrder;
    const [against] = commands.setPolyAgainst.mock.invocationCallOrder;
    expect(beats).toBeLessThan(against ?? 0);
  });
});
