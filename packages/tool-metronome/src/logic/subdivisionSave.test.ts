import {
  createLibraryStore,
  createMetronomeStore,
  type LibraryRepositories,
  type MetronomeCommands,
} from '@kitbag/core-state';
import { describe, expect, it, type Mock, vi } from 'vitest';

const SONG_ID = 7;

function setup() {
  const spies: Record<string, Mock> = {};
  const commands = new Proxy(spies, {
    get: (target, name: string) => (target[name] ??= vi.fn()),
  }) as unknown as MetronomeCommands;
  const update = vi.fn(() => Promise.resolve());
  const list = () => Promise.resolve([]);
  const repos = {
    setlists: { list },
    presets: { list, update },
  } as unknown as LibraryRepositories;
  const metronome = createMetronomeStore(commands);
  const library = createLibraryStore({
    repos: () => repos,
    metronome: () => metronome.getState(),
  });
  return { metronome, library, update };
}

describe('a live subdivision change while a song is loaded', () => {
  it('stays unsaved like a live tempo change', () => {
    const { metronome, update } = setup();
    metronome.getState().setTempo(133);
    metronome.getState().setSubdivision(4);
    expect(update).not.toHaveBeenCalled();
  });

  it('is written to the song by Save current, with the tempo', async () => {
    const { metronome, library, update } = setup();
    metronome.getState().setBeats(12, 8);
    metronome.getState().setTempo(133);
    metronome.getState().setSubdivision(4);
    await library.getState().saveCurrentInto(SONG_ID);
    expect(update).toHaveBeenCalledWith(
      SONG_ID,
      expect.objectContaining({ bpm: 133, denominator: 8, subdivision: 4 }),
    );
  });
});
