import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';

import {
  ADVANCE_CAUSE,
  ADVANCE_OUTCOME,
  type AdvanceCause,
  type AdvanceListener,
  type AdvanceOutcome,
} from '../stemPlayer/songEnd.ts';
import { startAutoAdvance, type ArrivalState } from './autoAdvance.ts';
import { restingPlayer } from './autoAdvance.test-helper.ts';
import {
  closeDatabases,
  queuedIds,
  setup,
  stems,
} from './store.test-helper.ts';

afterEach(closeDatabases);

const CAUSES = [ADVANCE_CAUSE.ended, ADVANCE_CAUSE.next];
const SETLIST_CANDIDATES = 2;
const OPEN_ATTEMPTS = 2;

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

async function heldLoad() {
  const song = await setup();
  const { order } = song;
  let leave: AdvanceListener = () => undefined;
  let standing = true;
  let finish: (outcome: AdvanceOutcome) => void = () => undefined;
  const advanceTo = vi.fn(
    () =>
      new Promise<AdvanceOutcome>((resolve) => {
        finish = resolve;
      }),
  );
  startAutoAdvance({
    players: {
      stems: {
        ...restingPlayer(),
        onSongEnd: (listener) => {
          leave = listener;
          return () => undefined;
        },
        advanceTo,
        stillEnded: () => standing,
      },
      song: restingPlayer(),
    },
    peekNext: () => order.getState().peekNext(),
    commitNext: (next, stands) => order.getState().commitNext(next, stands),
    placeOf: () => null,
    candidates: () => order.getState().queue.length + SETLIST_CANDIDATES,
    commitOpen: (entry) => order.getState().commitOpen(entry),
    arrivals: createStore<ArrivalState>(() => ({ arrival: null })),
  });
  const loading = async (cause: AdvanceCause) => {
    leave(cause);
    await vi.waitFor(() => {
      expect(advanceTo).toHaveBeenCalled();
    });
  };
  const loaded = async (outcome: AdvanceOutcome) => {
    finish(outcome);
    await settle();
  };
  const anotherSongOpens = () => {
    standing = false;
  };
  return { ...song, advanceTo, loading, loaded, anotherSongOpens };
}

describe.each(CAUSES)(
  'another song opening while %s loads the next one',
  (cause) => {
    it('leaves a queued song queued', async () => {
      const h = await heldLoad();
      await h.order.getState().enqueue(stems(h.c));
      await h.loading(cause);
      h.anotherSongOpens();
      await h.loaded(ADVANCE_OUTCOME.displaced);
      expect(queuedIds(h.order)).toEqual([h.c]);
    });

    it('leaves the setlist cursor where it was', async () => {
      const h = await heldLoad();
      h.putOnStage(h.click.id);
      const before = await h.order.getState().peekNext();
      await h.loading(cause);
      h.anotherSongOpens();
      await h.loaded(ADVANCE_OUTCOME.displaced);
      expect(await h.order.getState().peekNext()).toEqual(before);
    });

    it('keeps the queue a song played from Up next left', async () => {
      const h = await heldLoad();
      for (const id of [h.a, h.b, h.c])
        await h.order.getState().enqueue(stems(id));
      await h.loading(cause);
      h.anotherSongOpens();
      await h.order.getState().playQueued(stems(h.c));
      await h.loaded(ADVANCE_OUTCOME.displaced);
      expect(queuedIds(h.order)).toEqual([]);
    });

    it('keeps the setlist entry that song put on stage', async () => {
      const h = await heldLoad();
      h.putOnStage(h.click.id);
      await h.loading(cause);
      h.anotherSongOpens();
      h.putOnStage(h.first.id);
      await h.loaded(ADVANCE_OUTCOME.displaced);
      expect((await h.order.getState().peekNext()).advance).toMatchObject({
        entry: { item: { id: h.click.id } },
      });
    });

    it('moves on past a song that will not open', async () => {
      const h = await heldLoad();
      await h.order.getState().enqueue(stems(h.c));
      await h.loading(cause);
      await h.loaded(ADVANCE_OUTCOME.unplayable);
      expect(queuedIds(h.order)).toEqual([]);
      expect(h.advanceTo).toHaveBeenCalledTimes(OPEN_ATTEMPTS);
      expect(h.advanceTo.mock.calls[1]).not.toEqual([h.c]);
    });
  },
);
