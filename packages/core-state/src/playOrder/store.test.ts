import { deleteStemSet } from '@kitbag/core-db/src/stem-bundle-repository';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ADVANCE } from './order.ts';
import {
  closeDatabases,
  heldWrite,
  queuedIds,
  queuedSongs,
  setup,
  song,
  stems,
} from './store.test-helper.ts';

afterEach(closeDatabases);

const DISK_FULL = 'disk full';
const UNDO_FAILED = 'undo failed';

describe('play order', () => {
  it('plays the queue first, then carries on through the setlist', async () => {
    const { order, a, c } = await setup();
    await order.getState().enqueue(stems(c));
    expect(await order.getState().advance()).toEqual({
      kind: ADVANCE.stems,
      stemSetId: c,
      setlistItemId: null,
    });
    expect(queuedIds(order)).toEqual([]);
    expect(await order.getState().advance()).toMatchObject({
      kind: ADVANCE.stems,
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
      kind: ADVANCE.stems,
      stemSetId: b,
    });
  });

  it('skips a queued stem song deleted before the advance', async () => {
    const { order, handle, a, c } = await setup();
    await order.getState().enqueue(stems(c));
    await deleteStemSet(handle.db, c);
    expect(await order.getState().advance()).toMatchObject({
      kind: ADVANCE.stems,
      stemSetId: a,
      setlistItemId: expect.any(Number) as unknown,
    });
  });

  it('looks ahead without taking a queued song or moving the cursor', async () => {
    const { order, c, first, putOnStage } = await setup();
    await order.getState().enqueue(stems(c));
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
    expect(step.advance).toMatchObject({ kind: ADVANCE.stems, stemSetId: b });
    expect((await order.getState().peekNext()).advance).toEqual({
      kind: ADVANCE.end,
    });
  });

  it('ends after the last entry', async () => {
    const { order, last, putOnStage } = await setup();
    putOnStage(last.id);
    expect(await order.getState().advance()).toEqual({ kind: ADVANCE.end });
  });

  it('puts Play next first and Add to queue last', async () => {
    const { order, a, b, single } = await setup();
    await order.getState().addToQueue(stems(a));
    await order.getState().playNext(song(single));
    await order.getState().addToQueue(stems(b));
    expect(queuedSongs(order)).toEqual([song(single), stems(a), stems(b)]);
  });

  it('moves a queued song to the front on Play next and to the end on Add to queue', async () => {
    const { order, a, b, c } = await setup();
    for (const id of [a, b, c]) await order.getState().addToQueue(stems(id));
    await order.getState().playNext(stems(c));
    expect(queuedIds(order)).toEqual([c, a, b]);
    await order.getState().addToQueue(stems(c));
    expect(queuedIds(order)).toEqual([a, b, c]);
  });

  it('plays a queued single song between stem songs, then the setlist', async () => {
    const { order, a, c, single } = await setup();
    await order.getState().addToQueue(stems(c));
    await order.getState().addToQueue(song(single));
    expect(await order.getState().advance()).toMatchObject({
      kind: ADVANCE.stems,
      stemSetId: c,
    });
    expect(await order.getState().advance()).toEqual({
      kind: ADVANCE.song,
      songId: single,
    });
    expect(queuedSongs(order)).toEqual([]);
    expect(await order.getState().advance()).toMatchObject({
      kind: ADVANCE.stems,
      stemSetId: a,
    });
  });

  it('queues a song once', async () => {
    const { order, a, b } = await setup();
    await order.getState().enqueue(stems(a));
    await order.getState().enqueue(stems(b));
    await order.getState().enqueue(stems(a));
    expect(queuedIds(order)).toEqual([a, b]);
  });

  it('drops the songs queued above one that is played', async () => {
    const { order, a, b, c } = await setup();
    for (const id of [a, b, c]) await order.getState().enqueue(stems(id));
    await order.getState().playQueued(stems(b));
    expect(queuedIds(order)).toEqual([c]);
  });

  it('reorders, removes and clears the queue', async () => {
    const { order, a, b, c } = await setup();
    for (const id of [a, b, c]) await order.getState().enqueue(stems(id));
    await order.getState().moveQueued(stems(c), 0);
    expect(queuedIds(order)).toEqual([c, a, b]);
    await order.getState().removeQueued(stems(a));
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
      kind: ADVANCE.stems,
      stemSetId: a,
      setlistItemId: again.id,
    });
  });
});

describe('a press while the next step is committed', () => {
  it('leaves a queued song queued', async () => {
    const hold = heldWrite();
    const { order, c } = await setup(hold.afterWrite);
    await order.getState().enqueue(stems(c));
    const step = await order.getState().peekNext();
    const commit = order.getState().commitNext(step.advance, hold.stands);
    hold.press();
    hold.release();
    expect(await commit).toBeNull();
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
    expect(await commit).toBeNull();
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
    expect(await commit).toBeNull();
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
    expect(await commit).toBeNull();
    expect((await order.getState().peekNext()).advance).toEqual({
      kind: ADVANCE.end,
    });
  });

  it('does not queue again the song the press played from Up next', async () => {
    const hold = heldWrite();
    const { order, a, b, c } = await setup(hold.afterWrite);
    for (const id of [a, b, c]) await order.getState().enqueue(stems(id));
    const step = await order.getState().peekNext();
    const commit = order.getState().commitNext(step.advance, hold.stands);
    hold.press();
    const tap = order.getState().playQueued(stems(a));
    hold.release();
    await Promise.all([commit, tap]);
    expect(queuedIds(order)).toEqual([b, c]);
  });

  it('keeps the queue a later song played from Up next left', async () => {
    const hold = heldWrite();
    const { order, a, b, c } = await setup(hold.afterWrite);
    for (const id of [a, b, c]) await order.getState().enqueue(stems(id));
    const step = await order.getState().peekNext();
    const commit = order.getState().commitNext(step.advance, hold.stands);
    hold.press();
    const tap = order.getState().playQueued(stems(c));
    hold.release();
    await Promise.all([commit, tap]);
    expect(queuedIds(order)).toEqual([]);
  });

  it('keeps the queued songs ahead of one added during the commit', async () => {
    const hold = heldWrite();
    const { order, a, b, c } = await setup(hold.afterWrite);
    for (const id of [a, b]) await order.getState().enqueue(stems(id));
    const step = await order.getState().peekNext();
    const commit = order.getState().commitNext(step.advance, hold.stands);
    hold.press();
    await order.getState().enqueue(stems(c));
    hold.release();
    expect(await commit).toBeNull();
    expect(queuedIds(order)).toEqual([a, b, c]);
  });

  it('takes the step when the end still stands', async () => {
    const hold = heldWrite();
    const { order, c } = await setup(hold.afterWrite);
    await order.getState().enqueue(stems(c));
    const step = await order.getState().peekNext();
    const commit = order.getState().commitNext(step.advance, hold.stands);
    hold.release();
    expect(await commit).not.toBeNull();
    expect(queuedIds(order)).toEqual([]);
  });
});

describe('a commit whose write fails', () => {
  const failing = () => Promise.reject(new Error(DISK_FULL));

  it('puts the queued song back', async () => {
    const { order, c } = await setup(failing);
    await order.getState().enqueue(stems(c));
    const step = await order.getState().peekNext();
    await expect(order.getState().commitNext(step.advance)).rejects.toThrow(
      DISK_FULL,
    );
    await order.getState().refresh();
    expect(queuedIds(order)).toEqual([c]);
  });

  it('throws the failed write, not a failed undo', async () => {
    const { order, queue, c } = await setup(failing);
    await order.getState().enqueue(stems(c));
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

describe('opening a metronome entry', () => {
  it('loads its preset onto the stage', async () => {
    const { order, click, last, putOnStage, first } = await setup();
    putOnStage(first.id);
    const { advance } = await order.getState().peekNext();
    expect(advance).toMatchObject({ entry: { item: { id: click.id } } });
    if (advance.kind !== ADVANCE.open) return;
    await order.getState().openEntry(advance.entry);
    expect(order.getState().upNext()).toMatchObject({
      entry: { item: { id: last.id } },
    });
  });

  it('puts a metronome entry back off the stage when a press lands during its load', async () => {
    const hold = heldWrite();
    const { order, click, first, putOnStage } = await setup(hold.afterWrite);
    putOnStage(first.id);
    const { advance } = await order.getState().peekNext();
    if (advance.kind !== ADVANCE.open)
      throw new Error('expected a metronome entry');
    const commit = order.getState().commitOpen(advance.entry, hold.stands);
    hold.press();
    hold.release();
    expect(await commit).toBe(false);
    expect(order.getState().upNext()).toMatchObject({
      entry: { item: { id: click.id } },
    });
  });

  it('keeps a metronome entry on the stage when its load stands', async () => {
    const { order, last, first, putOnStage } = await setup();
    putOnStage(first.id);
    const { advance } = await order.getState().peekNext();
    if (advance.kind !== ADVANCE.open)
      throw new Error('expected a metronome entry');
    expect(await order.getState().commitOpen(advance.entry)).toBe(true);
    expect(order.getState().upNext()).toMatchObject({
      entry: { item: { id: last.id } },
    });
  });
});
