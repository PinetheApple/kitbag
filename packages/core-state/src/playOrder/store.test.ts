import { createPlayQueueRepository } from '@kitbag/core-db/src/play-queue-repository';
import { createSetlistRepository } from '@kitbag/core-db/src/setlist-repository';
import { createSongPresetRepository } from '@kitbag/core-db/src/song-preset-repository';
import { openTestDatabase } from '@kitbag/core-db/src/sqlite.test-helper';
import { deleteStemSet } from '@kitbag/core-db/src/stem-bundle-repository';
import { insertStemSet } from '@kitbag/core-db/src/stem-entries.test-helper';
import { afterEach, describe, expect, it } from 'vitest';

import { takeSnapshot } from '../library/snapshot.ts';
import { ADVANCE, cursorOf } from './order.ts';
import { createPlayOrderStore } from './store.ts';

const handles: ReturnType<typeof openTestDatabase>[] = [];

afterEach(() => {
  for (const { connection } of handles.splice(0)) connection.close();
});

async function setup() {
  const handle = openTestDatabase();
  handles.push(handle);
  const queue = createPlayQueueRepository(handle);
  const library = {
    setlists: createSetlistRepository(handle),
    presets: createSongPresetRepository(handle),
  };
  const [a, b, c] = [
    await insertStemSet(handle.db, 'A'),
    await insertStemSet(handle.db, 'B'),
    await insertStemSet(handle.db, 'C'),
  ];
  const warmUp = await library.presets.create({
    name: 'Warm-up',
    bpm: 120,
    beatsPerBar: 4,
    subdivision: 1,
    accents: new Uint8Array([2, 1, 1, 1]),
    polyEnabled: false,
    polyBeats: 0,
    sound: 0,
  });
  const gig = await library.setlists.create('Gig');
  const first = await library.setlists.addStemSet(gig.id, a);
  const click = await library.setlists.add(gig.id, warmUp.id);
  const last = await library.setlists.addStemSet(gig.id, b);
  const setlist = async () => (await takeSnapshot(library)).entries[gig.id];
  let entries = (await setlist()) ?? [];
  const reload = async () => {
    entries = (await setlist()) ?? [];
  };
  let onStage: number | null = null;
  const stage = () => ({ setlistId: gig.id, entries });
  const order = createPlayOrderStore({
    queue: () => queue,
    stage,
    cursor: () =>
      cursorOf(stage(), { presetId: 0, itemId: onStage, setlistId: gig.id }),
    refreshStage: reload,
    playSetlistEntry: (itemId) => {
      onStage = itemId;
      return Promise.resolve();
    },
  });
  const putOnStage = (itemId: number) => {
    onStage = itemId;
  };
  await order.getState().refresh();
  return {
    order,
    queue,
    library,
    handle,
    gig,
    a,
    b,
    c,
    first,
    click,
    last,
    reload,
    putOnStage,
  };
}

const queuedIds = (order: Awaited<ReturnType<typeof setup>>['order']) =>
  order.getState().queue.map((entry) => entry.stemSetId);

describe('play order', () => {
  it('plays the queue first, then carries on through the setlist', async () => {
    const { order, a, c } = await setup();
    await order.getState().enqueue(c);
    expect(await order.getState().advance()).toEqual({
      kind: ADVANCE.play,
      stemSetId: c,
      setlistItemId: null,
    });
    expect(queuedIds(order)).toEqual([]);
    expect(await order.getState().advance()).toMatchObject({
      kind: ADVANCE.play,
      stemSetId: a,
    });
  });

  it('stops at a metronome entry and stays stopped until it is opened', async () => {
    const { order, first, click, b, putOnStage } = await setup();
    putOnStage(first.id);
    const stop = await order.getState().advance();
    expect(stop).toMatchObject({ kind: ADVANCE.open });
    expect(await order.getState().advance()).toEqual(stop);
    putOnStage(click.id);
    expect(await order.getState().advance()).toMatchObject({
      kind: ADVANCE.play,
      stemSetId: b,
    });
  });

  it('skips a queued stem song deleted before the advance', async () => {
    const { order, handle, a, c } = await setup();
    await order.getState().enqueue(c);
    await deleteStemSet(handle.db, c);
    expect(await order.getState().advance()).toMatchObject({
      kind: ADVANCE.play,
      stemSetId: a,
      setlistItemId: expect.any(Number) as unknown,
    });
  });

  it('looks ahead without taking a queued song or moving the cursor', async () => {
    const { order, c, first, putOnStage } = await setup();
    await order.getState().enqueue(c);
    const queuedNext = await order.getState().peekNext();
    expect(await order.getState().peekNext()).toEqual(queuedNext);
    expect(queuedIds(order)).toEqual([c]);
    await order.getState().commitNext(queuedNext.advance);
    expect(queuedIds(order)).toEqual([]);
    putOnStage(first.id);
    const setlistNext = await order.getState().peekNext();
    expect(setlistNext.advance).toMatchObject({ kind: ADVANCE.open });
    await order.getState().commitNext(setlistNext.advance);
    expect(await order.getState().peekNext()).toEqual(setlistNext);
  });

  it('moves the cursor onto a stem entry only when that step is committed', async () => {
    const { order, b, click, putOnStage } = await setup();
    putOnStage(click.id);
    const step = await order.getState().peekNext();
    expect(await order.getState().peekNext()).toEqual(step);
    await order.getState().commitNext(step.advance);
    expect(step.advance).toMatchObject({ kind: ADVANCE.play, stemSetId: b });
    expect((await order.getState().peekNext()).advance).toEqual({
      kind: ADVANCE.end,
    });
  });

  it('ends after the last entry', async () => {
    const { order, last, putOnStage } = await setup();
    putOnStage(last.id);
    expect(await order.getState().advance()).toEqual({ kind: ADVANCE.end });
  });

  it('queues a song once', async () => {
    const { order, a, b } = await setup();
    await order.getState().enqueue(a);
    await order.getState().enqueue(b);
    await order.getState().enqueue(a);
    expect(queuedIds(order)).toEqual([a, b]);
  });

  it('drops the songs queued above one that is played', async () => {
    const { order, a, b, c } = await setup();
    for (const id of [a, b, c]) await order.getState().enqueue(id);
    await order.getState().playQueued(b);
    expect(queuedIds(order)).toEqual([c]);
  });

  it('reorders, removes and clears the queue', async () => {
    const { order, a, b, c } = await setup();
    for (const id of [a, b, c]) await order.getState().enqueue(id);
    await order.getState().moveQueued(c, 0);
    expect(queuedIds(order)).toEqual([c, a, b]);
    await order.getState().removeQueued(a);
    expect(queuedIds(order)).toEqual([c, b]);
    await order.getState().clearQueue();
    expect(queuedIds(order)).toEqual([]);
  });

  it('plays a song the setlist repeats at each of its places', async () => {
    const { order, library, gig, a, last, reload, putOnStage } = await setup();
    const again = await library.setlists.addStemSet(gig.id, a);
    await reload();
    putOnStage(last.id);
    expect(await order.getState().advance()).toEqual({
      kind: ADVANCE.play,
      stemSetId: a,
      setlistItemId: again.id,
    });
  });
});
