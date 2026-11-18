// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act, createElement } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const SONG_ID = 7;

const song = vi.hoisted(() => ({
  state: {},
  togglePlay: vi.fn(),
  close: vi.fn(),
}));

vi.mock('react-native', () => ({ View: 'View' }));

vi.mock('@kitbag/core-design', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  MiniPlayerBar: 'MiniPlayerBar',
}));

vi.mock('@kitbag/core-state', () => ({
  loopEndFrames: () => null,
  useSongPlayer: (select: (state: unknown) => unknown) => select(song.state),
}));

const { MiniPlayer, useMiniPlayerShown } = await import('./MiniPlayer.tsx');

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const frame = { progress: { value: 0.4 }, playing: { value: 1 } };
const usePlayhead = vi.fn(() => frame as never);
const onOpenSong = vi.fn();

function givenSong(change: Record<string, unknown> = {}) {
  song.state = {
    status: 'ready',
    songId: SONG_ID,
    title: 'Everlong',
    artist: 'Foo Fighters',
    click: true,
    engineRate: 48_000,
    durationFrames: 480_000,
    togglePlay: song.togglePlay,
    close: song.close,
    ...change,
  };
}

function mount(): ReactTestRenderer {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(
      createElement(MiniPlayer, { usePlayhead, onOpenSong, bottomInset: 0 }),
    );
  });
  if (tree === undefined) throw new Error('not mounted');
  return tree;
}

function bar(tree: ReactTestRenderer) {
  return tree.root.findByType('MiniPlayerBar' as never).props as Record<
    string,
    unknown
  >;
}

beforeEach(() => {
  vi.clearAllMocks();
  givenSong();
});

describe('the mini-player', () => {
  it.each([
    ['no song is open', { status: 'idle', songId: null }],
    ['the song is still opening', { status: 'loading' }],
    ['the song failed', { status: 'failed' }],
  ])('draws nothing when %s', (_, change) => {
    givenSong(change);
    expect(mount().toJSON()).toBeNull();
    expect(usePlayhead).not.toHaveBeenCalled();
  });

  it('shows the title, the artist and the click state', () => {
    expect(bar(mount())).toMatchObject({
      title: 'Everlong',
      detail: 'Foo Fighters · Click on',
    });
  });

  it('draws the engine playhead, never a store copy', () => {
    const props = bar(mount());
    expect(usePlayhead).toHaveBeenCalledWith(48_000, 480_000, null);
    expect(props.progress).toBe(frame.progress);
    expect(props.playing).toBe(frame.playing);
  });

  it('plays and pauses the song', () => {
    (bar(mount()).onTogglePlay as () => void)();
    expect(song.togglePlay).toHaveBeenCalledOnce();
  });

  it('stops the song from its close key', () => {
    (bar(mount()).onClose as () => void)();
    expect(song.close).toHaveBeenCalledOnce();
  });

  it('opens the player on a tap', () => {
    (bar(mount()).onOpen as () => void)();
    expect(onOpenSong).toHaveBeenCalledExactlyOnceWith(SONG_ID);
  });
});

describe('whether a screen docks the mini-player', () => {
  function shown() {
    let value: boolean | undefined;
    const Probe = () => {
      value = useMiniPlayerShown();
      return null;
    };
    act(() => {
      create(createElement(Probe));
    });
    return value;
  }

  it.each([
    ['ready', true],
    ['loading', false],
    ['failed', false],
    ['missing', false],
    ['idle', false],
  ])('a %s song: %s', (status, expected) => {
    givenSong({ status });
    expect(shown()).toBe(expected);
  });
});
