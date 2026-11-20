import { playerWaveBars } from '@kitbag/core-design';
import {
  autoAdvanceDeps,
  configurePlayOrder,
  libraryStore,
  PREVIOUS_RESTARTS_AFTER_SECONDS,
  songLibraryStore,
  startAutoAdvance,
  type QueuedSong,
} from '@kitbag/core-state';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  fakeQueue,
  queued,
  setQueued,
  stemRow,
  stems,
} from './playQueue.test-helper.ts';
import {
  at,
  flush,
  mountTracked,
  SET_ID,
  unmountTracked,
  type Player,
} from './playerHarness.test-helper.tsx';

const NIGHT_BUS = 21;
const PREVIOUS = 'Previous';
const PAST = PREVIOUS_RESTARTS_AFTER_SECONDS + 1;

configurePlayOrder({ queue: fakeQueue() });
startAutoAdvance(autoAdvanceDeps(playerWaveBars));

const libraryBefore = libraryStore.getState();

beforeEach(() => {
  setQueued([]);
  songLibraryStore.setState({ rows: [stemRow(NIGHT_BUS, 'Night Bus')] });
});

afterEach(() => {
  unmountTracked();
  libraryStore.setState(libraryBefore, true);
});

const plain = (song: QueuedSong) => ({ song, setlistItemId: null });

const previousOff = (p: Player) =>
  (p.byLabel(PREVIOUS).props.accessibilityState as { disabled: boolean })
    .disabled;

describe('Previous beside Up next', () => {
  it('is off for the first song heard while it is in its first seconds', async () => {
    const p = await mountTracked();
    expect(previousOff(p)).toBe(true);
    expect(p.has('Nothing queued')).toBe(true);
    expect(p.has('Playback stops when this song ends')).toBe(true);
  });

  it('turns on past the restart threshold and starts the song again', async () => {
    const p = await mountTracked();
    p.engine.position = at(PAST);
    p.frames(PAST);
    expect(previousOff(p)).toBe(false);
    await p.press(PREVIOUS);
    await flush();
    expect(p.commands.mixerSeek).toHaveBeenCalledWith(0);
    expect(p.routes.onOpenStemSet).not.toHaveBeenCalled();
  });

  it('goes back to the song heard before, queueing the one it leaves first', async () => {
    libraryStore.setState({
      heard: [plain(stems(NIGHT_BUS)), plain(stems(SET_ID))],
    });
    const p = await mountTracked();
    expect(previousOff(p)).toBe(false);
    await p.press(PREVIOUS);
    await flush();
    expect(p.routes.onOpenStemSet).toHaveBeenCalledWith(NIGHT_BUS);
    expect(queued).toEqual([stems(SET_ID)]);
    expect(libraryStore.getState().heard).toEqual([plain(stems(NIGHT_BUS))]);
  });
});
