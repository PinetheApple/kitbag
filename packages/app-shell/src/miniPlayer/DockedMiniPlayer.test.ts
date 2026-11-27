import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Props = Record<string, unknown>;

const world = vi.hoisted(() => ({
  songShown: false,
  off: [] as string[],
  drawn: [] as [string, Props][],
  push: vi.fn<(href: string) => void>(),
}));

const recorder = vi.hoisted(() => (name: string) => (props: Props) => {
  world.drawn.push([name, props]);
  return null;
});

vi.mock('expo-router', () => ({ useRouter: () => ({ push: world.push }) }));
vi.mock('@kitbag/tool-library', () => ({
  MiniPlayer: recorder('MiniPlayer'),
  useMiniPlayerShown: () => world.songShown,
}));
vi.mock('@kitbag/core-state', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useTools: <T>(selector: (state: { readonly off: string[] }) => T) =>
    selector(world),
}));
vi.mock('@kitbag/tool-stems', () => ({ useMixerFrame: () => undefined }));
vi.mock('@kitbag/tool-sync', () => ({
  PLAY_ALONG_NAME: 'Play along',
  PlayAlongMiniPlayer: recorder('PlayAlongMiniPlayer'),
}));
vi.mock('@/runtime/libraryRoutes', () => ({
  useLibraryRoutes: () => ({ openSong: vi.fn(), openStemSet: vi.fn() }),
}));

const { DockedMiniPlayer } = await import('./DockedMiniPlayer.tsx');
const { PLAY_ALONG_ROUTE, TOOL_ID } = await import('../home/registry.ts');

const BOTTOM = 24;

function render(songShown: boolean, off: string[] = []) {
  world.songShown = songShown;
  world.off = off;
  world.drawn.length = 0;
  renderToStaticMarkup(
    createElement(DockedMiniPlayer, {
      bottomInset: BOTTOM,
      onOpenQueue: vi.fn(),
    }),
  );
  return world.drawn;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('the docked mini-player', () => {
  it('shows only the song mini-player while a song is shown', () => {
    expect(render(true).map(([name]) => name)).toEqual(['MiniPlayer']);
  });

  it('shows only the Play along mini-player otherwise', () => {
    const drawn = render(false);
    expect(drawn.map(([name]) => name)).toEqual(['PlayAlongMiniPlayer']);
    expect(drawn[0]?.[1].bottomInset).toBe(BOTTOM);
  });

  it('reopens Play along from its mini-player', () => {
    const [[, props] = ['', {}]] = render(false);
    (props.onOpen as () => void)();
    expect(world.push).toHaveBeenCalledExactlyOnceWith(PLAY_ALONG_ROUTE);
  });

  it('shows no Play along mini-player while Play along is off', () => {
    expect(render(false, [TOOL_ID.sync])).toEqual([]);
  });

  it('still shows the song mini-player while Play along is off', () => {
    expect(render(true, [TOOL_ID.sync]).map(([name]) => name)).toEqual([
      'MiniPlayer',
    ]);
  });
});
