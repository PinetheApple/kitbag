import { afterEach, describe, expect, it } from 'vitest';

import { ADVANCE_CAUSE } from '../stemPlayer/songEnd.ts';
import { ARRIVAL } from './autoAdvance.ts';
import {
  endingHarness,
  stopEndingHarnesses,
} from './autoAdvance.test-helper.ts';
import { ADVANCE, type PlayerKind } from './order.ts';
import { SKIP } from './queuedSongText.ts';
import { REPEAT } from './repeat.ts';
import type { SkipResult } from './store.ts';

const NIGHT_BUS = 21;
const HUM = 41;

const stemsNext: SkipResult = {
  advance: { kind: ADVANCE.stems, stemSetId: NIGHT_BUS, setlistItemId: null },
  skipped: null,
};
const singleNext: SkipResult = {
  advance: { kind: ADVANCE.song, songId: HUM },
  skipped: null,
};

const leaving = (kind: PlayerKind, step: SkipResult) =>
  endingHarness({ mode: REPEAT.off, kind, steps: [step] });

afterEach(stopEndingHarnesses);

describe('Next that keeps the song paused', () => {
  it('opens the next stem song paused', async () => {
    const h = leaving('stems', stemsNext);
    await h.happens(ADVANCE_CAUSE.nextPaused);
    expect(h.players.stems.paused.takeOver).toHaveBeenCalledExactlyOnceWith(
      NIGHT_BUS,
    );
    expect(h.opens).not.toHaveBeenCalled();
  });

  it('hands a stem song over to a single song paused', async () => {
    const h = leaving('stems', singleNext);
    await h.happens(ADVANCE_CAUSE.nextPaused);
    expect(h.players.song.paused.takeOver).toHaveBeenCalledExactlyOnceWith(HUM);
    expect(h.opens).not.toHaveBeenCalled();
  });

  it('hands a single song over to a stem song paused', async () => {
    const h = leaving('song', stemsNext);
    await h.happens(ADVANCE_CAUSE.nextPaused);
    expect(h.players.stems.paused.takeOver).toHaveBeenCalledExactlyOnceWith(
      NIGHT_BUS,
    );
    expect(h.opens).not.toHaveBeenCalled();
  });

  it('hands over playing after an ordinary Next', async () => {
    const h = leaving('stems', singleNext);
    await h.happens(ADVANCE_CAUSE.nextInApp);
    expect(h.opens).toHaveBeenCalledExactlyOnceWith(HUM);
    expect(h.players.song.paused.takeOver).not.toHaveBeenCalled();
  });

  it('counts the paused song as played and keeps the skipped notice', async () => {
    const h = leaving('stems', { ...stemsNext, skipped: 'song' });
    await h.happens(ADVANCE_CAUSE.nextPaused);
    expect(h.notePlayed).toHaveBeenCalledExactlyOnceWith({
      kind: 'stems',
      id: NIGHT_BUS,
    });
    expect(h.seen.at(-1)).toMatchObject({
      kind: ARRIVAL.playing,
      skipped: { reason: SKIP.deleted, kind: 'song' },
      inApp: true,
    });
  });
});
