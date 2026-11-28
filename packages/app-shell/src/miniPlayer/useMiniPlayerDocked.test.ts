import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const shown = vi.hoisted(() => ({
  song: false,
  playAlong: false,
  settled: true,
  off: [] as string[],
}));

vi.mock('@kitbag/tool-library', () => ({
  useMiniPlayerShown: () => shown.song,
}));
vi.mock('@kitbag/tool-sync', () => ({
  usePlayAlongMiniShown: () => shown.playAlong,
}));
vi.mock('@kitbag/core-state', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useTools: <T>(selector: (state: { readonly off: string[] }) => T) =>
    selector(shown),
}));
vi.mock('./useDockSettled', () => ({ useDockSettled: () => shown.settled }));

const { useAnyMiniPlayerDocked, useSongMiniPlayerDocked } =
  await import('./useMiniPlayerDocked.ts');
const { TOOL_ID } = await import('../home/registry.ts');

function useDockedWhere(
  song: boolean,
  playAlong: boolean,
  settled = true,
  off: string[] = [],
) {
  Object.assign(shown, { song, playAlong, settled, off });
  const docked = { lists: false, player: false };
  const Probe = () => {
    docked.lists = useAnyMiniPlayerDocked();
    docked.player = useSongMiniPlayerDocked();
    return null;
  };
  renderToStaticMarkup(createElement(Probe));
  return docked;
}

describe('where a mini-player docks', () => {
  it('docks a song on Home, the lists and a viewed player', () => {
    expect(useDockedWhere(true, false)).toEqual({ lists: true, player: true });
  });

  it('docks Play along on Home and the lists only', () => {
    expect(useDockedWhere(false, true)).toEqual({ lists: true, player: false });
  });

  it('docks nothing for Play along while it is off', () => {
    expect(useDockedWhere(false, true, true, [TOOL_ID.sync])).toEqual({
      lists: false,
      player: false,
    });
  });

  it('still docks a song while Play along is off', () => {
    expect(useDockedWhere(true, true, true, [TOOL_ID.sync]).lists).toBe(true);
  });

  it('docks nothing before the screen settles', () => {
    expect(useDockedWhere(true, true, false)).toEqual({
      lists: false,
      player: false,
    });
  });
});
