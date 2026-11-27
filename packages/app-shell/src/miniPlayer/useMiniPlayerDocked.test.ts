import { describe, expect, it, vi } from 'vitest';

const shown = vi.hoisted(() => ({
  song: false,
  playAlong: false,
  settled: true,
}));

vi.mock('@kitbag/tool-library', () => ({
  useMiniPlayerShown: () => shown.song,
}));
vi.mock('@kitbag/tool-sync', () => ({
  usePlayAlongMiniShown: () => shown.playAlong,
}));
vi.mock('./useDockSettled', () => ({ useDockSettled: () => shown.settled }));

const { useAnyMiniPlayerDocked, useSongMiniPlayerDocked } =
  await import('./useMiniPlayerDocked.ts');

function useDockedWhere(song: boolean, playAlong: boolean, settled = true) {
  Object.assign(shown, { song, playAlong, settled });
  return { lists: useAnyMiniPlayerDocked(), player: useSongMiniPlayerDocked() };
}

describe('where a mini-player docks', () => {
  it('docks a song on Home, the lists and a viewed player', () => {
    expect(useDockedWhere(true, false)).toEqual({ lists: true, player: true });
  });

  it('docks Play along on Home and the lists only', () => {
    expect(useDockedWhere(false, true)).toEqual({ lists: true, player: false });
  });

  it('docks nothing before the screen settles', () => {
    expect(useDockedWhere(true, true, false)).toEqual({
      lists: false,
      player: false,
    });
  });
});
