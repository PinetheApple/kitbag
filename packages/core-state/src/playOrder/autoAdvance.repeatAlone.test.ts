import { afterEach, describe, expect, it } from 'vitest';

import { ADVANCE_CAUSE, ADVANCE_OUTCOME } from '../stemPlayer/songEnd.ts';
import { ARRIVAL } from './autoAdvance.ts';
import {
  end,
  endingHarness,
  metronomeNext,
  stopEndingHarnesses,
} from './autoAdvance.test-helper.ts';
import { HUM, TIN_ROOF } from './heard.test-helper.ts';
import { ADVANCE, type PlayerKind } from './order.ts';
import { REPEAT } from './repeat.ts';
import type { SkipResult } from './store.ts';

const ENDS_IN_A_ROW = 3;
const KINDS: readonly PlayerKind[] = ['stems', 'song'];

const queuedOf = (kind: PlayerKind) => (kind === 'song' ? HUM : TIN_ROOF);
const deletedNext = (kind: PlayerKind): SkipResult => ({
  ...end,
  skipped: kind,
});
const queuedNext = (kind: PlayerKind): SkipResult => {
  const { id } = queuedOf(kind);
  return {
    advance:
      kind === 'song'
        ? { kind: ADVANCE.song, songId: id }
        : { kind: ADVANCE.stems, stemSetId: id, setlistItemId: null },
    skipped: null,
  };
};

afterEach(stopEndingHarnesses);

describe.each(KINDS)('Repeat all with nothing up next, %s player', (kind) => {
  it('plays the song again when it ends', async () => {
    const h = endingHarness({ kind, mode: REPEAT.all, steps: [end] });
    await h.happens(ADVANCE_CAUSE.ended);
    expect(h.ending.replay).toHaveBeenCalledTimes(1);
    expect(h.ending.stopAdvancing).not.toHaveBeenCalled();
  });

  it('plays it again with no queue, setlist or played songs at all', async () => {
    const h = endingHarness({ kind, mode: REPEAT.all, candidates: 0 });
    await h.happens(ADVANCE_CAUSE.ended);
    expect(h.ending.replay).toHaveBeenCalledTimes(1);
    expect(h.ending.stopAdvancing).not.toHaveBeenCalled();
  });

  it('keeps playing it again at every end', async () => {
    const h = endingHarness({ kind, mode: REPEAT.all, candidates: 0 });
    for (let ends = 0; ends < ENDS_IN_A_ROW; ends++)
      await h.happens(ADVANCE_CAUSE.ended);
    expect(h.ending.replay).toHaveBeenCalledTimes(ENDS_IN_A_ROW);
  });

  it('lets an A-B loop win', async () => {
    const h = endingHarness({ kind, mode: REPEAT.all, loopHeld: true });
    await h.happens(ADVANCE_CAUSE.ended);
    expect(h.ending.replay).not.toHaveBeenCalled();
  });

  it('still plays a queued song next rather than this one', async () => {
    const steps = [queuedNext(kind)];
    const h = endingHarness({ kind, mode: REPEAT.all, steps });
    await h.happens(ADVANCE_CAUSE.ended);
    expect(h.opens).toHaveBeenCalledExactlyOnceWith(queuedOf(kind).id);
    expect(h.ending.replay).not.toHaveBeenCalled();
    expect(h.ending.stopAdvancing).not.toHaveBeenCalled();
  });

  it('plays it again when every queued song was deleted', async () => {
    const steps = [deletedNext(kind)];
    const h = endingHarness({ kind, mode: REPEAT.all, steps });
    await h.happens(ADVANCE_CAUSE.ended);
    expect(h.ending.replay).toHaveBeenCalledTimes(1);
    expect(h.ending.stopAdvancing).not.toHaveBeenCalled();
    expect(h.seen).toEqual([]);
  });

  it('stops after a queued song fails to open, then a deletion', async () => {
    const steps = [queuedNext(kind), deletedNext(kind)];
    const h = endingHarness({
      kind,
      mode: REPEAT.all,
      steps,
      outcomes: [ADVANCE_OUTCOME.unplayable],
    });
    await h.happens(ADVANCE_CAUSE.ended);
    expect(h.ending.replay).not.toHaveBeenCalled();
    expect(h.players[kind].stopAdvancing).toHaveBeenCalledTimes(1);
    expect(h.seen.at(-1)?.kind).toBe(ARRIVAL.gaveUp);
  });

  it('stops after a queued song fails to open with nothing after it', async () => {
    const h = endingHarness({
      kind,
      mode: REPEAT.all,
      steps: [queuedNext(kind)],
      candidates: 2,
      outcomes: [ADVANCE_OUTCOME.unplayable],
    });
    await h.happens(ADVANCE_CAUSE.ended);
    expect(h.ending.replay).not.toHaveBeenCalled();
    expect(h.players[kind].stopAdvancing).toHaveBeenCalledTimes(1);
  });

  it('stops before a metronome song up next', async () => {
    const steps = [metronomeNext];
    const h = endingHarness({ kind, mode: REPEAT.all, steps });
    await h.happens(ADVANCE_CAUSE.ended);
    expect(h.ending.replay).not.toHaveBeenCalled();
    expect(h.ending.stopAdvancing).toHaveBeenCalledTimes(1);
  });

  it('does not restart the song on a Next press', async () => {
    const h = endingHarness({ kind, mode: REPEAT.all, steps: [end] });
    await h.happens(ADVANCE_CAUSE.next);
    expect(h.ending.replay).not.toHaveBeenCalled();
  });

  it('stops and says a deleted song was skipped with Repeat off', async () => {
    const steps = [deletedNext(kind)];
    const h = endingHarness({ kind, mode: REPEAT.off, steps });
    await h.happens(ADVANCE_CAUSE.ended);
    expect(h.ending.replay).not.toHaveBeenCalled();
    expect(h.ending.stopAdvancing).toHaveBeenCalledTimes(1);
    expect(h.seen.map((arrival) => arrival.kind)).toEqual([ARRIVAL.gaveUp]);
  });

  it('stops with Repeat off', async () => {
    const h = endingHarness({ kind, mode: REPEAT.off, steps: [end] });
    await h.happens(ADVANCE_CAUSE.ended);
    expect(h.ending.replay).not.toHaveBeenCalled();
    expect(h.ending.stopAdvancing).toHaveBeenCalledTimes(1);
  });
});
