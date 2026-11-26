import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Props = Record<string, unknown>;

const world = vi.hoisted(() => ({
  bar: undefined as Props | undefined,
  session: undefined as { appLabel: string; playing: boolean } | undefined,
  store: {
    lock: undefined as object | undefined,
    playPause: vi.fn(),
    unlock: vi.fn(),
  },
}));

vi.mock('react-native-reanimated', () => ({
  useSharedValue: (value: number) => ({ value }),
}));
vi.mock('@kitbag/core-design', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  MiniPlayerBar: (props: Props) => {
    world.bar = props;
    return null;
  },
}));
vi.mock('./playAlongHooks.ts', () => ({
  usePlayAlong: <T,>(select: (state: typeof world.store) => T) =>
    select(world.store),
  useFollowedSession: () => world.session,
}));
vi.mock('./usePlayAlongProgress.ts', () => ({
  usePlayAlongProgress: () => ({ value: 0 }),
}));

const { PlayAlongMiniPlayer } = await import('./PlayAlongMiniPlayer.tsx');

const onOpen = vi.fn();

const drawnBar = (): Props | undefined => world.bar;

function render(): Props | undefined {
  world.bar = undefined;
  renderToStaticMarkup(
    createElement(PlayAlongMiniPlayer, { bottomInset: 0, onOpen }),
  );
  return drawnBar();
}

beforeEach(() => {
  world.store.lock = {
    sessionId: 's',
    track: { title: 'Blinding Lights', artist: 'The Weeknd', durationMs: null },
  };
  world.session = { appLabel: 'Spotify', playing: true };
});

describe('the Play along mini-player', () => {
  it('shows nothing while no lock holds', () => {
    world.store.lock = undefined;
    expect(render()).toBeUndefined();
  });

  it('names the track and the app it is locked to on the Play along tile', () => {
    const bar = render();
    expect(bar?.tile).toBe('playAlong');
    expect(bar?.title).toBe('Blinding Lights');
    expect(bar?.detail).toBe('Play along · locked to Spotify');
  });

  it("pauses the other app, reopens Play along and ends following on close", () => {
    const bar = render();
    expect(bar?.onTogglePlay).toBe(world.store.playPause);
    expect(bar?.onOpen).toBe(onOpen);
    expect(bar?.onClose).toBe(world.store.unlock);
  });

  it("shows the other app's play state", () => {
    expect((render()?.playing as { value: number }).value).toBe(1);
    world.session = { appLabel: 'Spotify', playing: false };
    expect((render()?.playing as { value: number }).value).toBe(0);
  });

  it('has no Queue key', () => {
    expect(render()?.queue).toBeUndefined();
  });
});
