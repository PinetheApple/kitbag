import { CountSquare } from '@kitbag/core-design';
import { KITBAG_HOST_OBJECT_KEY } from '@kitbag/core-native';
import {
  arrivalStore,
  SKIP,
  SKIPPED_UNOPENED_STEM_SONG,
  songLibraryStore,
  ARRIVAL,
  type ArrivalEvent,
  type LibraryStemSetRow,
} from '@kitbag/core-state';
import {
  record,
  stem,
} from '@kitbag/core-state/src/stemPlayer/store.test-helper.ts';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { animatedStyleOf, runFrame } from '../testing/reanimatedDriver.ts';
import {
  at,
  flush,
  mountTracked,
  SONG_DETAILS,
  type Player,
} from './playerHarness.test-helper.tsx';

const NIGHT_BUS = 8;
const HARBOUR = 9;
const COUNT_BEATS = 4;
const SONG_SECONDS = 10;
const nightBus = record([stem(3)], {
  id: NIGHT_BUS,
  title: 'Night Bus',
  ...SONG_DETAILS,
  bars: [{ beat: 0, beatsPerBar: COUNT_BEATS }],
});

const row = (id: number, title: string): LibraryStemSetRow => ({
  kind: 'stems',
  id,
  title,
  artist: null,
  stemCount: 1,
  durationSec: 10,
  bpm: 120,
  key: null,
  scale: null,
  hasGrid: true,
  createdAt: new Date(0),
});

beforeEach(() => {
  songLibraryStore.setState({ rows: [row(NIGHT_BUS, 'Night Bus')] });
});

afterEach(() => {
  arrivalStore.setState({ arrival: null });
});

let serial = 0;

function arrive(event: ArrivalEvent) {
  serial++;
  act(() => {
    arrivalStore.setState({ arrival: { ...event, serial } });
  });
}

type PlayingEvent = Extract<ArrivalEvent, { kind: typeof ARRIVAL.playing }>;

const playingNow = (
  stemSetId: number,
  change: Partial<Pick<PlayingEvent, 'place' | 'skipped'>> = {},
): PlayingEvent => ({
  kind: ARRIVAL.playing,
  stemSetId,
  place: null,
  skipped: null,
  ...change,
});

async function advanced(
  p: Player,
  change: Parameters<typeof playingNow>[1] = {},
  song = nightBus,
) {
  p.endSong(at(SONG_SECONDS));
  p.records.readStemSet.mockResolvedValueOnce(song);
  arrive({ kind: ARRIVAL.arriving, stemSetId: song.id });
  await act(async () => {
    await p.store.getState().advanceTo(song.id);
  });
  arrive(playingNow(song.id, change));
  await flush();
}

const NOT_COUNTING = 0;
const COUNTING = 1;

function engineCount(countingIn: number, currentBeat: number) {
  (globalThis as unknown as Record<string, unknown>)[KITBAG_HOST_OBJECT_KEY] = {
    mixer_position: 0,
    mixer_playing: 0,
    frames_rendered: countingIn === COUNTING ? 0 : at(SONG_SECONDS),
    counting_in: countingIn,
    current_beat: currentBeat,
  };
  act(() => {
    runFrame();
  });
}

const countingIn = (currentBeat: number) => {
  engineCount(COUNTING, currentBeat);
};

const squareNodes = (p: Player) => p.renderer.root.findAllByType(CountSquare);

const squares = (p: Player) =>
  squareNodes(p).map((square) => square.props.beat as number);

function countPanel(p: Player) {
  const [first] = squareNodes(p);
  if (first?.parent == null) throw new Error('no count squares');
  return {
    opacity: animatedStyleOf(first.parent.props.style).opacity,
    beat: (first.props.currentBeat as { value: number }).value,
  };
}

describe('the player after an auto-advance', () => {
  it('follows the next song in the route without opening it again', async () => {
    const p = await mountTracked();
    await advanced(p);
    expect(p.routes.onOpenStemSet).toHaveBeenCalledWith(NIGHT_BUS);
    await p.showSet(NIGHT_BUS);
    expect(p.records.readStemSet).toHaveBeenCalledTimes(2);
    expect(p.store.getState()).toMatchObject({
      setId: NIGHT_BUS,
      title: 'Night Bus',
    });
  });

  it('follows as soon as the next song is picked', async () => {
    const p = await mountTracked();
    arrive({ kind: ARRIVAL.arriving, stemSetId: NIGHT_BUS });
    expect(p.routes.onOpenStemSet).toHaveBeenCalledWith(NIGHT_BUS);
  });

  it('follows a Next from the card onto a metronome song to the metronome', async () => {
    const p = await mountTracked();
    arrive({ kind: ARRIVAL.metronome });
    expect(p.routes.onOpenMetronome).toHaveBeenCalledTimes(1);
    expect(p.routes.onOpenStemSet).not.toHaveBeenCalled();
  });

  it('keeps its hold through one advance after another', async () => {
    const p = await mountTracked();
    await advanced(p);
    await p.showSet(NIGHT_BUS);
    await advanced(p, {}, { ...nightBus, id: HARBOUR, title: 'Harbour' });
    await p.showSet(HARBOUR);
    expect(p.records.readStemSet).toHaveBeenCalledTimes(3);
    expect(p.store.getState()).toMatchObject({
      setId: HARBOUR,
      status: 'ready',
    });
  });

  it('acquires the song it advanced to when it gets the player back', async () => {
    const p = await mountTracked();
    await advanced(p);
    await p.showSet(NIGHT_BUS);
    p.setFocused(false);
    act(() => {
      p.store.getState().close();
    });
    p.records.readStemSet.mockResolvedValueOnce(nightBus);
    p.setFocused(true);
    await flush();
    expect(p.records.readStemSet).toHaveBeenLastCalledWith(NIGHT_BUS);
    expect(p.store.getState().setId).toBe(NIGHT_BUS);
  });

  it('keeps the advanced song when the screen leaves', async () => {
    const p = await mountTracked();
    await advanced(p);
    await p.showSet(NIGHT_BUS);
    p.unmount();
    expect(p.store.getState().setId).toBe(NIGHT_BUS);
    expect(p.commands.songTransportHide).not.toHaveBeenCalled();
  });

  it('names the song and its place in the set', async () => {
    const p = await mountTracked();
    await advanced(p, { place: { number: 3, of: 5 } });
    expect(p.has('Playing Night Bus · 3 of 5')).toBe(true);
  });

  it('says it skipped a song that would not open', async () => {
    const p = await mountTracked();
    await advanced(p, { skipped: SKIP.unopened });
    expect(p.has(SKIPPED_UNOPENED_STEM_SONG)).toBe(true);
  });

  it('says only that it skipped when the next song will not open', async () => {
    const p = await mountTracked();
    p.endSong(at(SONG_SECONDS));
    p.records.readStemSet.mockResolvedValueOnce(undefined);
    arrive({ kind: ARRIVAL.arriving, stemSetId: NIGHT_BUS });
    await act(async () => {
      await p.store.getState().advanceTo(NIGHT_BUS);
    });
    const harbour = { ...nightBus, id: HARBOUR, title: 'Harbour' };
    p.records.readStemSet.mockResolvedValueOnce(harbour);
    arrive({ kind: ARRIVAL.arriving, stemSetId: HARBOUR });
    await act(async () => {
      await p.store.getState().advanceTo(HARBOUR);
    });
    arrive(playingNow(HARBOUR, { skipped: SKIP.unopened }));
    await flush();
    expect(p.texts().some((text) => text.startsWith('Playing'))).toBe(false);
    expect(p.has(SKIPPED_UNOPENED_STEM_SONG)).toBe(true);
  });

  it('lights the squares from the engine count', async () => {
    const p = await mountTracked();
    p.countInBars.mockReturnValue(1);
    await advanced(p);
    countingIn(2);
    expect(countPanel(p)).toEqual({ opacity: 1, beat: 2 });
  });

  it('drops the squares once its count is over', async () => {
    const p = await mountTracked();
    p.countInBars.mockReturnValue(1);
    await advanced(p);
    countingIn(1);
    engineCount(NOT_COUNTING, -1);
    expect(squares(p)).toEqual([]);
  });

  it('shows no squares for a Play pressed after the advance', async () => {
    const p = await mountTracked();
    p.countInBars.mockReturnValue(1);
    await advanced(p);
    countingIn(1);
    engineCount(NOT_COUNTING, -1);
    p.engine.now = at(SONG_SECONDS);
    await p.press('Play');
    countingIn(0);
    expect(p.commands.songCountIn).toHaveBeenCalledTimes(2);
    expect(squares(p)).toEqual([]);
  });

  it('shows no squares for a count a press restarted', async () => {
    const p = await mountTracked();
    p.countInBars.mockReturnValue(1);
    await advanced(p);
    countingIn(1);
    act(() => {
      p.store.getState().togglePlay();
    });
    p.engine.now = at(1);
    act(() => {
      p.store.getState().togglePlay();
    });
    countingIn(0);
    expect(p.commands.songCountIn).toHaveBeenCalledTimes(2);
    expect(squares(p)).toEqual([]);
  });

  it('shows the count squares over the stems while the song counts in', async () => {
    const p = await mountTracked();
    p.countInBars.mockReturnValue(1);
    await advanced(p);
    countingIn(1);
    expect(squares(p)).toEqual([0, 1, 2, 3]);
  });

  it('shows no count squares for a count-in started with Play', async () => {
    const p = await mountTracked();
    p.countInBars.mockReturnValue(1);
    await p.press('Play');
    countingIn(1);
    expect(squares(p)).toEqual([]);
  });
});
