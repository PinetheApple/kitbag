import { CountSquare } from '@kitbag/core-design';
import { KITBAG_HOST_OBJECT_KEY } from '@kitbag/core-native';
import {
  arrivalStore,
  SKIP,
  SKIPPED_UNOPENED_STEM_SONG,
  songLibraryStore,
  type Arrival,
  type LibraryStemSetRow,
} from '@kitbag/core-state';
import {
  record,
  stem,
} from '@kitbag/core-state/src/stemPlayer/store.test-helper.ts';
import { act } from 'react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { runFrame } from '../testing/reanimatedDriver.ts';
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

function arrive(change: Partial<Arrival>) {
  serial++;
  act(() => {
    arrivalStore.setState({
      arrival: {
        serial,
        stemSetId: NIGHT_BUS,
        place: null,
        skipped: null,
        ...change,
      },
    });
  });
}

async function advanced(
  p: Player,
  change: Partial<Arrival> = {},
  song = nightBus,
) {
  p.endSong(at(SONG_SECONDS));
  p.records.readStemSet.mockResolvedValueOnce(song);
  arrive({ stemSetId: song.id, ...change });
  await act(async () => {
    await p.store.getState().advanceTo(song.id);
  });
  await flush();
}

function countingIn(currentBeat: number) {
  (globalThis as unknown as Record<string, unknown>)[KITBAG_HOST_OBJECT_KEY] = {
    mixer_position: 0,
    mixer_playing: 0,
    frames_rendered: 0,
    counting_in: 1,
    current_beat: currentBeat,
  };
  act(() => {
    runFrame();
  });
}

const squares = (p: Player) =>
  p.renderer.root
    .findAllByType(CountSquare)
    .map((square) => square.props.beat as number);

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
    p.unmount();
    expect(p.store.getState().setId).toBeNull();
  });

  it('lets go of the advanced song when the screen leaves', async () => {
    const p = await mountTracked();
    await advanced(p);
    await p.showSet(NIGHT_BUS);
    p.unmount();
    expect(p.store.getState().setId).toBeNull();
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
