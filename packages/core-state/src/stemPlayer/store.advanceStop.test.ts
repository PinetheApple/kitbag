import { describe, expect, it, vi } from 'vitest';

import type { AutoAdvanceDeps } from '../playOrder/autoAdvance.ts';
import { startAutoAdvance } from '../playOrder/autoAdvance.ts';
import { ADVANCE, type Advance } from '../playOrder/order.ts';
import type { SkipResult } from '../playOrder/store.ts';
import { ADVANCE_OUTCOME } from './songEnd.ts';
import {
  at,
  BARS,
  opened,
  record,
  SONG_DETAILS,
  SONG_FRAMES,
  stem,
  TWO_FOUR,
} from './store.test-helper.ts';

const NEXT_SET_ID = 8;
const PAUSE = { action: 'pause', frame: null } as const;
const NEXT = { action: 'next', frame: null } as const;
const NEXT_STEP: SkipResult = {
  advance: { kind: ADVANCE.play, stemSetId: NEXT_SET_ID, setlistItemId: null },
  skipped: false,
};
const nextSong = record([stem(2)], {
  id: NEXT_SET_ID,
  title: 'Next',
  ...SONG_DETAILS,
  bars: TWO_FOUR,
});

async function advancing() {
  const song = await opened([stem(1)]);
  song.store.getState().acquireSong(7, BARS);
  await vi.waitFor(() => {
    expect(song.store.getState().status).toBe('ready');
  });
  song.store.getState().togglePlay();
  song.countInBars.mockReturnValue(1);
  song.endSong(SONG_FRAMES);
  vi.clearAllMocks();
  song.records.readStemSet.mockResolvedValueOnce(nextSong);
  const outcome = song.store.getState().advanceTo(NEXT_SET_ID);
  return { ...song, outcome };
}

describe('a card Stop while the next song opens', () => {
  it('opens the next song without starting it or its count-in', async () => {
    const song = await advancing();
    song.stopSongFromNotification();
    expect(await song.outcome).toBe(ADVANCE_OUTCOME.stopped);
    expect(song.store.getState()).toMatchObject({
      status: 'ready',
      setId: NEXT_SET_ID,
      countEndFrame: null,
    });
    expect(song.commands.mixerPlay).not.toHaveBeenCalled();
    expect(song.commands.songCountIn).not.toHaveBeenCalled();
  });

  it('leaves the card to the engine, neither showing nor hiding it', async () => {
    const song = await advancing();
    song.stopSongFromNotification();
    await song.outcome;
    expect(song.commands.songTransportShow).not.toHaveBeenCalled();
    expect(song.commands.songTransportHide).not.toHaveBeenCalled();
  });

  it('lets the next song play from a press once it has opened', async () => {
    const song = await advancing();
    song.stopSongFromNotification();
    await song.outcome;
    song.store.getState().togglePlay();
    expect(song.commands.songCountIn).toHaveBeenCalledTimes(1);
  });
});

describe('the next song opening without a Stop', () => {
  it('starts as before', async () => {
    const song = await advancing();
    expect(await song.outcome).toBe(ADVANCE_OUTCOME.playing);
    expect(song.commands.songCountIn).toHaveBeenCalledTimes(1);
  });

  it('starts despite a Stop on the song that ended, before the advance', async () => {
    const song = await advancing();
    await song.outcome;
    song.stopSongFromNotification();
    song.endSong(SONG_FRAMES);
    vi.clearAllMocks();
    song.records.readStemSet.mockResolvedValueOnce(nextSong);
    expect(await song.store.getState().advanceTo(NEXT_SET_ID)).toBe(
      ADVANCE_OUTCOME.playing,
    );
  });

  it('starts despite a Pause, which the card sends only during a count', async () => {
    const song = await advancing();
    song.requestFromNotification(PAUSE);
    expect(await song.outcome).toBe(ADVANCE_OUTCOME.playing);
    expect(song.commands.songCountIn).toHaveBeenCalledTimes(1);
  });
});

async function followingPlayOrder() {
  const song = await opened([stem(1)]);
  song.store.getState().acquireSong(7, BARS);
  await vi.waitFor(() => {
    expect(song.store.getState().status).toBe('ready');
  });
  song.store.getState().togglePlay();
  song.engine.playing = true;
  song.engine.position = at(1);
  let peeked: (step: SkipResult) => void = () => undefined;
  const commitNext = vi.fn((_next: Advance, stands: () => boolean) =>
    Promise.resolve(stands()),
  );
  const player = song.store.getState();
  const deps: AutoAdvanceDeps = {
    onSongEnd: player.onSongEnd,
    advanceTo: player.advanceTo,
    peekNext: () =>
      new Promise((resolve) => {
        peeked = resolve;
      }),
    commitNext,
    placeOf: () => null,
    candidates: () => 1,
    stillEnded: player.songStillEnded,
    stopAdvancing: player.stopAdvancing,
    commitOpen: () => Promise.resolve(false),
    handToMetronome: player.handToMetronome,
    arrivals: { setState: vi.fn() } as unknown as AutoAdvanceDeps['arrivals'],
  };
  startAutoAdvance(deps);
  const shown = song.commands.songTransportShow.mock.lastCall?.[0].session;
  vi.clearAllMocks();
  song.records.readStemSet.mockResolvedValue(nextSong);
  const peekAnswered = async () => {
    peeked(NEXT_STEP);
    await new Promise((resolve) => setTimeout(resolve, 0));
  };
  const pressNext = () => {
    song.requestFromNotification(NEXT, shown);
  };
  return { ...song, commitNext, peekAnswered, pressNext };
}

describe('a card Stop before the advance opens anything', () => {
  it('after a card Next, ends the advance without committing a step', async () => {
    const song = await followingPlayOrder();
    song.pressNext();
    song.stopSongFromNotification();
    await song.peekAnswered();
    expect(song.commitNext).not.toHaveBeenCalled();
    expect(song.records.readStemSet).not.toHaveBeenCalled();
    expect(song.commands.mixerPlay).not.toHaveBeenCalled();
    expect(song.commands.songCountIn).not.toHaveBeenCalled();
  });

  it('after the song ended, advances to nothing', async () => {
    const song = await followingPlayOrder();
    song.endSong(SONG_FRAMES);
    song.stopSongFromNotification();
    await song.peekAnswered();
    expect(song.commitNext).not.toHaveBeenCalled();
    expect(song.records.readStemSet).not.toHaveBeenCalled();
    expect(song.commands.mixerPlay).not.toHaveBeenCalled();
  });
});
