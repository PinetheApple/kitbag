import { afterEach, describe, expect, it } from 'vitest';

import {
  ADVANCE_CAUSE,
  ADVANCE_OUTCOME,
  type AdvanceOutcome,
} from '../stemPlayer/songEnd.ts';
import {
  endingHarness,
  stopEndingHarnesses,
} from './autoAdvance.test-helper.ts';
import { ADVANCE } from './order.ts';
import { REPEAT, type RepeatMode } from './repeat.ts';
import type { SkipResult } from './store.ts';

const NIGHT_BUS = 21;

const nextSong: SkipResult = {
  advance: { kind: ADVANCE.stems, stemSetId: NIGHT_BUS, setlistItemId: null },
  skipped: null,
};

afterEach(stopEndingHarnesses);

function harness(
  mode: RepeatMode,
  loopHeld = false,
  next: SkipResult = nextSong,
  outcome: AdvanceOutcome = ADVANCE_OUTCOME.playing,
) {
  return endingHarness({ mode, loopHeld, steps: [next], outcomes: [outcome] });
}

describe('Repeat one at the end of a song', () => {
  it('plays the same song again from the start', async () => {
    const h = harness(REPEAT.one);
    await h.happens(ADVANCE_CAUSE.ended);
    expect(h.ending.replay).toHaveBeenCalledTimes(1);
    expect(h.peekNext).not.toHaveBeenCalled();
    expect(h.opens).not.toHaveBeenCalled();
  });

  it('lets an A-B loop win: nothing restarts and nothing advances', async () => {
    const h = harness(REPEAT.one, true);
    await h.happens(ADVANCE_CAUSE.ended);
    expect(h.ending.replay).not.toHaveBeenCalled();
    expect(h.peekNext).not.toHaveBeenCalled();
    expect(h.opens).not.toHaveBeenCalled();
  });

  it('still moves to the next entry on a Next press', async () => {
    const h = harness(REPEAT.one);
    await h.happens(ADVANCE_CAUSE.nextInApp);
    expect(h.opens).toHaveBeenCalledWith(NIGHT_BUS);
    expect(h.ending.replay).not.toHaveBeenCalled();
  });
});

describe('Repeat off and Repeat all at the end of a song', () => {
  it.each([REPEAT.off, REPEAT.all])(
    'with %s, plays what is up next rather than the same song',
    async (mode) => {
      const h = harness(mode);
      await h.happens(ADVANCE_CAUSE.ended);
      expect(h.opens).toHaveBeenCalledWith(NIGHT_BUS);
      expect(h.ending.replay).not.toHaveBeenCalled();
    },
  );
});

describe('a queued song kept for the next Repeat all round', () => {
  it('is noted once it plays', async () => {
    const h = harness(REPEAT.all);
    await h.happens(ADVANCE_CAUSE.ended);
    expect(h.notePlayed).toHaveBeenCalledExactlyOnceWith({
      kind: 'stems',
      id: NIGHT_BUS,
    });
  });

  it.each([ADVANCE_OUTCOME.displaced, ADVANCE_OUTCOME.unplayable])(
    'is not noted when it comes out %s',
    async (outcome) => {
      const h = harness(REPEAT.all, false, nextSong, outcome);
      await h.happens(ADVANCE_CAUSE.ended);
      expect(h.notePlayed).not.toHaveBeenCalled();
    },
  );

  it('is never a setlist entry', async () => {
    const entry: SkipResult = {
      advance: { kind: ADVANCE.stems, stemSetId: NIGHT_BUS, setlistItemId: 3 },
      skipped: null,
    };
    const h = harness(REPEAT.all, false, entry);
    await h.happens(ADVANCE_CAUSE.ended);
    expect(h.opens).toHaveBeenCalledWith(NIGHT_BUS);
    expect(h.notePlayed).not.toHaveBeenCalled();
  });
});
