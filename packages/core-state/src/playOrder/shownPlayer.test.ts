import { afterEach, describe, expect, it, vi } from 'vitest';

import { libraryStore } from '../library/store.ts';
import { songPlayerStore } from '../songPlayer/store.ts';
import { stemPlayerStore } from '../stemPlayer/store.ts';
import { moveOffDeleted } from './deletedSong.ts';
import { UP_NEXT_SOURCE } from './order.ts';
import { shownPlayer } from './shownPlayer.ts';
import { playOrderStore } from './store.ts';

const SET_ID = 5;
const DELETED = { kind: 'stems', id: SET_ID } as const;
const QUEUED = { kind: 'song', id: 6 } as const;

function showingDeleted(upNext: boolean) {
  stemPlayerStore.setState({ status: 'ready', setId: SET_ID });
  const stems = stemPlayerStore.getState();
  const nothing = () => undefined;
  vi.spyOn(playOrderStore.getState(), 'upNext').mockReturnValue(
    upNext ? { source: UP_NEXT_SOURCE.queue, song: QUEUED } : undefined,
  );
  return {
    pressNext: vi.spyOn(stems, 'pressNext').mockImplementation(nothing),
    pressNextPaused: vi
      .spyOn(stems, 'pressNextPaused')
      .mockImplementation(nothing),
    closeStems: vi.spyOn(stems, 'close').mockImplementation(nothing),
    closeSong: vi
      .spyOn(songPlayerStore.getState(), 'close')
      .mockImplementation(nothing),
    endSession: vi
      .spyOn(libraryStore.getState(), 'endListeningSession')
      .mockImplementation(nothing),
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('moving the real players off a deleted song', () => {
  it('presses Next when the deleted song was playing', () => {
    const spies = showingDeleted(true);
    moveOffDeleted(shownPlayer, DELETED, true);
    expect(spies.pressNext).toHaveBeenCalledOnce();
    expect(spies.pressNextPaused).not.toHaveBeenCalled();
    expect(spies.closeStems).not.toHaveBeenCalled();
  });

  it('presses the paused Next when the deleted song was paused', () => {
    const spies = showingDeleted(true);
    moveOffDeleted(shownPlayer, DELETED, false);
    expect(spies.pressNextPaused).toHaveBeenCalledOnce();
    expect(spies.pressNext).not.toHaveBeenCalled();
  });

  it('closes both players and ends the session when nothing is next', () => {
    const spies = showingDeleted(false);
    moveOffDeleted(shownPlayer, DELETED, true);
    expect(spies.closeStems).toHaveBeenCalledOnce();
    expect(spies.closeSong).toHaveBeenCalledOnce();
    expect(spies.endSession).toHaveBeenCalledOnce();
    expect(spies.pressNext).not.toHaveBeenCalled();
  });
});
