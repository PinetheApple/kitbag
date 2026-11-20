import { playerWaveBars } from '@kitbag/core-design';
import {
  autoAdvanceDeps,
  configurePlayOrder,
  heardStore,
  libraryStore,
  PREVIOUS_RESTARTS_AFTER_SECONDS,
  songLibraryStore,
  startAutoAdvance,
} from '@kitbag/core-state';
import { plain } from '@kitbag/core-state/src/playOrder/heard.test-helper.ts';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  fakeQueue,
  queued,
  setQueued,
  stemRow,
  stems,
  withQueue,
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
const TIN_ROOF = 22;
const PREVIOUS = 'Previous';
const PAST = PREVIOUS_RESTARTS_AFTER_SECONDS + 1;
const PRACTICE_SPEED = 0.75;
const WITHIN_SONG_PAST_WALL = PREVIOUS_RESTARTS_AFTER_SECONDS - 0.5;

configurePlayOrder({ queue: fakeQueue() });
startAutoAdvance(autoAdvanceDeps(playerWaveBars));

const libraryBefore = libraryStore.getState();

beforeEach(() => {
  setQueued([]);
  heardStore.setState({ heard: [] });
  songLibraryStore.setState({
    rows: [stemRow(NIGHT_BUS, 'Night Bus'), stemRow(TIN_ROOF, 'Tin Roof')],
  });
});

afterEach(() => {
  unmountTracked();
  libraryStore.setState(libraryBefore, true);
});

const previousOff = (p: Player) =>
  (p.byLabel(PREVIOUS).props.accessibilityState as { disabled: boolean })
    .disabled;

function playedTo(p: Player, songSeconds: number) {
  p.engine.position = at(songSeconds);
  p.frames(songSeconds);
}

describe('the Up next row', () => {
  it('says playback stops, with no Next, when nothing is up next', async () => {
    const p = await withQueue();
    expect(p.has('Nothing queued')).toBe(true);
    expect(p.has('Playback stops when this song ends')).toBe(true);
    expect(p.labelled('Open')).toEqual([]);
    const nextKeys = p.renderer.root.findAll((node) =>
      String(node.props.accessibilityLabel).startsWith('Next:'),
    );
    expect(nextKeys).toEqual([]);
  });

  it('names the first queued song and skips to it, dropping it from the queue', async () => {
    const p = await withQueue(NIGHT_BUS, TIN_ROOF);
    expect(p.has('Night Bus')).toBe(true);
    expect(p.has('Next in queue · 1 more after it')).toBe(true);
    await p.press('Next: Night Bus');
    await flush();
    expect(p.routes.onOpenStemSet).toHaveBeenCalledWith(NIGHT_BUS);
    expect(queued).toEqual([stems(TIN_ROOF)]);
  });
});

describe('Previous beside Up next', () => {
  it('is off for the first song heard while it is in its first seconds', async () => {
    const p = await mountTracked();
    expect(previousOff(p)).toBe(true);
  });

  it('turns on past the restart threshold and starts the song again', async () => {
    const p = await mountTracked();
    playedTo(p, PAST);
    expect(previousOff(p)).toBe(false);
    await p.press(PREVIOUS);
    await flush();
    expect(p.commands.mixerSeek).toHaveBeenCalledWith(0);
    expect(p.routes.onOpenStemSet).not.toHaveBeenCalled();
  });

  it('judges the threshold in song time at practice speed, as the press does', async () => {
    const p = await mountTracked();
    await p.store.getState().setSpeed(PRACTICE_SPEED);
    playedTo(p, WITHIN_SONG_PAST_WALL);
    expect(previousOff(p)).toBe(true);
    playedTo(p, PAST);
    expect(previousOff(p)).toBe(false);
    await p.press(PREVIOUS);
    await flush();
    expect(p.commands.mixerSeek).toHaveBeenCalledWith(0);
  });

  it('goes back to the song heard before, queueing the one it leaves first', async () => {
    heardStore.setState({
      heard: [plain(stems(NIGHT_BUS)), plain(stems(SET_ID))],
    });
    const p = await mountTracked();
    expect(previousOff(p)).toBe(false);
    await p.press(PREVIOUS);
    await flush();
    expect(p.routes.onOpenStemSet).toHaveBeenCalledWith(NIGHT_BUS);
    expect(queued).toEqual([stems(SET_ID)]);
    expect(heardStore.getState().heard).toEqual([plain(stems(NIGHT_BUS))]);
  });
});
