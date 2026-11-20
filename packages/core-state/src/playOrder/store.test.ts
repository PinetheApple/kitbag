import { createPlayQueueRepository } from '@kitbag/core-db/src/play-queue-repository';
import { createSetlistRepository } from '@kitbag/core-db/src/setlist-repository';
import { createSongPresetRepository } from '@kitbag/core-db/src/song-preset-repository';
import { openTestDatabase } from '@kitbag/core-db/src/sqlite.test-helper';
import { deleteStemSet } from '@kitbag/core-db/src/stem-bundle-repository';
import { insertStemSet } from '@kitbag/core-db/src/stem-entries.test-helper';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { takeSnapshot } from '../library/snapshot.ts';
import { ADVANCE, cursorOf } from './order.ts';
import { createPlayOrderStore } from './store.ts';

const handles: ReturnType<typeof openTestDatabase>[] = [];

afterEach(() => {
  for (const { connection } of handles.splice(0)) connection.close();
});

const DISK_FULL = 'disk full';
const UNDO_FAILED = 'undo failed';

function deferred() {
  let resolve: () => void = () => undefined;
  const promise = new Promise<void>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function heldWrite() {
  const write = deferred();
  let standing = true;
  return {
    afterWrite: () => write.promise,
    stands: () => standing,
    press: () => {
      standing = false;
    },
    release: write.resolve,
  };
}

async function setup(
  afterWrite: () => Promise<void> = () => Promise.resolve(),
) {
  const handle = openTestDatabase();
  handles.push(handle);
  const repository = createPlayQueueRepository(handle);
  const queue = {
    ...repository,
    takeThrough: async (stemSetId: number) => {
      await repository.takeThrough(stemSetId);
      await afterWrite();
    },
  };
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
  let moves = 0;
  const putOnStage = (itemId: number) => {
    onStage = itemId;
    moves++;
  };
  const stage = () => ({ setlistId: gig.id, entries });
  const order = createPlayOrderStore({
    queue: () => queue,
    stage,
    cursor: () =>
      cursorOf(stage(), { presetId: 0, itemId: onStage, setlistId: gig.id }),
    refreshStage: reload,
    playSetlistEntry: (itemId) => {
      putOnStage(itemId);
      return afterWrite();
    },
    markStage: () => {
      const at = onStage;
      let written = moves;
      return {
        wrote: () => {
          written = moves;
        },
        restore: () => {
          if (moves === written) onStage = at;
        },
      };
    },
  });
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

describe('a press while the next step is committed', () => {
  it('leaves a queued song queued', async () => {
    const hold = heldWrite();
    const { order, c } = await setup(hold.afterWrite);
    await order.getState().enqueue(c);
    const step = await order.getState().peekNext();
    const commit = order.getState().commitNext(step.advance, hold.stands);
    hold.press();
    hold.release();
    expect(await commit).toBe(false);
    expect(queuedIds(order)).toEqual([c]);
    expect(await order.getState().peekNext()).toEqual(step);
  });

  it('leaves the setlist cursor where it was', async () => {
    const hold = heldWrite();
    const { order, click, putOnStage } = await setup(hold.afterWrite);
    putOnStage(click.id);
    const step = await order.getState().peekNext();
    const commit = order.getState().commitNext(step.advance, hold.stands);
    hold.press();
    hold.release();
    expect(await commit).toBe(false);
    expect(await order.getState().peekNext()).toEqual(step);
  });

  it('keeps an entry the press itself put on stage', async () => {
    const hold = heldWrite();
    const { order, click, first, putOnStage } = await setup(hold.afterWrite);
    putOnStage(click.id);
    const step = await order.getState().peekNext();
    const commit = order.getState().commitNext(step.advance, hold.stands);
    hold.press();
    putOnStage(first.id);
    hold.release();
    expect(await commit).toBe(false);
    expect((await order.getState().peekNext()).advance).toMatchObject({
      kind: ADVANCE.open,
    });
  });

  it('keeps the setlist entry the press itself opened again', async () => {
    const hold = heldWrite();
    const { order, click, last, putOnStage } = await setup(hold.afterWrite);
    putOnStage(click.id);
    const step = await order.getState().peekNext();
    const commit = order.getState().commitNext(step.advance, hold.stands);
    hold.press();
    putOnStage(last.id);
    hold.release();
    expect(await commit).toBe(false);
    expect((await order.getState().peekNext()).advance).toEqual({
      kind: ADVANCE.end,
    });
  });

  it('does not queue again the song the press played from Up next', async () => {
    const hold = heldWrite();
    const { order, a, b, c } = await setup(hold.afterWrite);
    for (const id of [a, b, c]) await order.getState().enqueue(id);
    const step = await order.getState().peekNext();
    const commit = order.getState().commitNext(step.advance, hold.stands);
    hold.press();
    const tap = order.getState().playQueued(a);
    hold.release();
    await Promise.all([commit, tap]);
    expect(queuedIds(order)).toEqual([b, c]);
  });

  it('keeps the queue a later song played from Up next left', async () => {
    const hold = heldWrite();
    const { order, a, b, c } = await setup(hold.afterWrite);
    for (const id of [a, b, c]) await order.getState().enqueue(id);
    const step = await order.getState().peekNext();
    const commit = order.getState().commitNext(step.advance, hold.stands);
    hold.press();
    const tap = order.getState().playQueued(c);
    hold.release();
    await Promise.all([commit, tap]);
    expect(queuedIds(order)).toEqual([]);
  });

  it('keeps the queued songs ahead of one added during the commit', async () => {
    const hold = heldWrite();
    const { order, a, b, c } = await setup(hold.afterWrite);
    for (const id of [a, b]) await order.getState().enqueue(id);
    const step = await order.getState().peekNext();
    const commit = order.getState().commitNext(step.advance, hold.stands);
    hold.press();
    await order.getState().enqueue(c);
    hold.release();
    expect(await commit).toBe(false);
    expect(queuedIds(order)).toEqual([a, b, c]);
  });

  it('takes the step when the end still stands', async () => {
    const hold = heldWrite();
    const { order, c } = await setup(hold.afterWrite);
    await order.getState().enqueue(c);
    const step = await order.getState().peekNext();
    const commit = order.getState().commitNext(step.advance, hold.stands);
    hold.release();
    expect(await commit).toBe(true);
    expect(queuedIds(order)).toEqual([]);
  });
});

describe('a commit whose write fails', () => {
  const failing = () => Promise.reject(new Error(DISK_FULL));

  it('puts the queued song back', async () => {
    const { order, c } = await setup(failing);
    await order.getState().enqueue(c);
    const step = await order.getState().peekNext();
    await expect(order.getState().commitNext(step.advance)).rejects.toThrow(
      DISK_FULL,
    );
    await order.getState().refresh();
    expect(queuedIds(order)).toEqual([c]);
  });

  it('throws the failed write, not a failed undo', async () => {
    const { order, queue, c } = await setup(failing);
    await order.getState().enqueue(c);
    const step = await order.getState().peekNext();
    vi.spyOn(queue, 'add').mockRejectedValue(new Error(UNDO_FAILED));
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    await expect(order.getState().commitNext(step.advance)).rejects.toThrow(
      DISK_FULL,
    );
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it('puts the setlist cursor back', async () => {
    const { order, click, putOnStage } = await setup(failing);
    putOnStage(click.id);
    const step = await order.getState().peekNext();
    await expect(order.getState().commitNext(step.advance)).rejects.toThrow(
      DISK_FULL,
    );
    expect(await order.getState().peekNext()).toEqual(step);
  });
});
