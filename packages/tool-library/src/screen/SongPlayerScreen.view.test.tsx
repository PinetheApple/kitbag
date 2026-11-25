// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { QUEUE_TEXT } from '@kitbag/core-design';
import { ARRIVAL, arrivalStore, VIEW_ONLY_REASON } from '@kitbag/core-state';
import { act, createElement } from 'react';
import type { ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  mount,
  pressBarAction,
  screen,
} from './SongPlayerScreen.mount.test-helper.ts';
import {
  display,
  mixer,
  OPEN_SONG,
  queue,
  resetScreenState,
} from './SongPlayerScreen.mocks.test-helper.ts';

vi.mock('./EndedSetlistSnackbar.tsx', () => ({
  EndedSetlistSnackbar: () => null,
}));
vi.mock('react-native', async () =>
  (await import('./SongPlayerScreen.mocks.test-helper.ts')).reactNativeMock(),
);

vi.mock('./SongClickChips.tsx', async () =>
  (await import('./SongPlayerScreen.mocks.test-helper.ts')).clickChipsMock(),
);

vi.mock('react-native-reanimated', async () =>
  (await import('./SongPlayerScreen.mocks.test-helper.ts')).reanimatedMock(),
);

vi.mock('@kitbag/core-design', async (original) =>
  (await import('./SongPlayerScreen.mocks.test-helper.ts')).coreDesignMock(
    original,
  ),
);

vi.mock('@kitbag/core-state', async (original) =>
  (await import('./SongPlayerScreen.mocks.test-helper.ts')).coreStateMock(
    original,
  ),
);

const MORE = 'More';

beforeEach(resetScreenState);

describe('a song viewed while another plays', () => {
  const PLAYING = 'Everlong';
  const DOCKED = 'DockedMiniPlayer';
  const renderMiniPlayer = () => createElement(DOCKED);
  const upNext = vi.fn(() => createElement('UpNextRow'));

  function viewing(routes: Parameters<typeof mount>[1] = {}) {
    display.viewing = true;
    display.playing = PLAYING;
    return mount(true, {
      view: true,
      renderUpNext: upNext,
      renderMiniPlayer,
      ...routes,
    });
  }

  function menuOf(tree: ReactTestRenderer) {
    pressBarAction(tree, MORE);
    return tree.root.findByType('Sheet' as never);
  }

  it('never takes the mixer, so the playing song stays loaded', () => {
    viewing();
    expect(mixer.opens).toBe(0);
  });

  it('takes the mixer once Play makes it the live player', () => {
    const tree = viewing();
    display.viewing = false;
    act(() => {
      tree.update(screen(true, { view: true, renderMiniPlayer }));
    });
    expect(mixer.opens).toBe(1);
  });

  it('hides Up next and docks the mini-player only while viewing', () => {
    const tree = viewing();
    expect(tree.root.findAllByType('UpNextRow' as never)).toEqual([]);
    expect(tree.root.findAllByType(DOCKED as never)).toHaveLength(1);
    display.viewing = false;
    act(() => {
      tree.update(
        screen(true, { view: true, renderUpNext: upNext, renderMiniPlayer }),
      );
    });
    expect(tree.root.findAllByType('UpNextRow' as never)).toHaveLength(1);
    expect(tree.root.findAllByType(DOCKED as never)).toEqual([]);
  });

  it('names both songs on the Play key', () => {
    const tree = viewing();
    expect(
      tree.root.findByType('PlayerTransport' as never).props.playLabel,
    ).toBe(`Play ${OPEN_SONG.title}. Stops ${PLAYING}.`);
  });

  it('does not follow the playing song or leave when it stops', () => {
    const own = { onBack: vi.fn(), onOpenSong: vi.fn() };
    const tree = viewing(own);
    act(() => {
      arrivalStore.setState({
        arrival: {
          kind: ARRIVAL.arriving,
          song: { kind: 'song', id: OPEN_SONG.songId + 1 },
          serial: Date.now(),
        },
      });
    });
    display.status = 'idle';
    act(() => {
      tree.update(screen(true, { view: true, ...own }));
    });
    expect(own.onOpenSong).not.toHaveBeenCalled();
    expect(own.onBack).not.toHaveBeenCalled();
  });

  it('hides Stop and waits for Play on Meter, Tempo and Tempo correction', () => {
    const tree = viewing();
    const sheet = menuOf(tree);
    expect(
      sheet.findAll(
        (node) =>
          String(node.type) === 'MenuRow' && node.props.label === 'Stop',
      ),
    ).toEqual([]);
    expect(sheet.findByType('MeterRow' as never).props).toMatchObject({
      disabled: true,
      reason: VIEW_ONLY_REASON,
    });
    expect(sheet.findByType('TempoModeRow' as never).props.reason).toBe(
      VIEW_ONLY_REASON,
    );
    const correction = sheet.find(
      (node) =>
        String(node.type) === 'MenuRow' &&
        node.props.label === 'Tempo correction',
    );
    expect(correction.props).toMatchObject({
      disabled: true,
      detail: VIEW_ONLY_REASON,
    });
  });
});

describe('Play next and Add to queue on the song player', () => {
  it.each([
    [QUEUE_TEXT.playNext, queue.playNext],
    [QUEUE_TEXT.addToQueue, queue.addToQueue],
  ])('%s queues this song', async (label, verb) => {
    const tree = mount();
    pressBarAction(tree, MORE);
    const row = tree.root.find(
      (node) => String(node.type) === 'MenuRow' && node.props.label === label,
    );
    await act(async () => {
      (row.props.onPress as () => void)();
      await Promise.resolve();
    });
    expect(verb).toHaveBeenCalledExactlyOnceWith({
      kind: 'song',
      id: OPEN_SONG.songId,
    });
  });
});
