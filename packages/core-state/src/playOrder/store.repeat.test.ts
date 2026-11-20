import { afterEach, describe, expect, it } from 'vitest';

import { ADVANCE, advanceOf, UP_NEXT_SOURCE } from './order.ts';
import { cycleRepeat, endRepeatRound, REPEAT, repeatStore } from './repeat.ts';
import {
  closeDatabases,
  queuedSongs,
  setup,
  song,
  stems,
} from './store.test-helper.ts';

afterEach(() => {
  closeDatabases();
  repeatStore.setState({ mode: REPEAT.off, played: [], restart: null });
});

async function atTheLastEntry() {
  const fixture = await setup();
  const { c, last, putOnStage } = fixture;
  putOnStage(last.id);
  repeatStore.setState({ mode: REPEAT.all, played: [stems(c)] });
  return fixture;
}

describe('the Repeat all wrap before it is crossed', () => {
  it('shows the played song up next without writing it to the queue', async () => {
    const { order, c, queue } = await atTheLastEntry();
    expect(order.getState().upNext()).toEqual({
      source: UP_NEXT_SOURCE.queue,
      song: stems(c),
    });
    expect(await queue.list()).toEqual([]);
  });

  it('is gone, with nothing queued, once Repeat is cycled away from all', async () => {
    const { order, queue } = await atTheLastEntry();
    cycleRepeat();
    expect(order.getState().upNext()).toBeUndefined();
    expect(await queue.list()).toEqual([]);
  });

  it('is gone, with nothing queued, after Stop', async () => {
    const { order, queue, first } = await atTheLastEntry();
    endRepeatRound();
    expect(order.getState().upNext()).toMatchObject({
      source: UP_NEXT_SOURCE.setlist,
      entry: { item: { id: first.id } },
    });
    expect(await queue.list()).toEqual([]);
  });

  it('leaves the last entry up next after Previous from it', async () => {
    const { order, click, last, putOnStage } = await atTheLastEntry();
    putOnStage(click.id);
    expect(order.getState().upNext()).toMatchObject({
      source: UP_NEXT_SOURCE.setlist,
      entry: { item: { id: last.id } },
    });
  });
});

describe('crossing the Repeat all wrap', () => {
  it('writes the played songs to the queue and starts the setlist again after them', async () => {
    const { order, c, first, single } = await atTheLastEntry();
    repeatStore.setState({ played: [stems(c), song(single)] });
    const next = advanceOf(order.getState().upNext());
    expect(next).toEqual({
      kind: ADVANCE.stems,
      stemSetId: c,
      setlistItemId: null,
    });
    await order.getState().commitNext(next);
    expect(queuedSongs(order)).toEqual([song(single)]);
    expect(repeatStore.getState().played).toEqual([]);
    await order.getState().commitNext(advanceOf(order.getState().upNext()));
    expect(order.getState().upNext()).toMatchObject({
      source: UP_NEXT_SOURCE.setlist,
      entry: { item: { id: first.id } },
    });
  });

  it('takes the wrap back when the step does not stand', async () => {
    const { order, c, queue } = await atTheLastEntry();
    const next = advanceOf(order.getState().upNext());
    expect(await order.getState().commitNext(next, () => false)).toBeNull();
    expect(await queue.list()).toEqual([]);
    expect(repeatStore.getState()).toMatchObject({
      played: [stems(c)],
      restart: null,
    });
  });
});
