import { describe, expect, it, vi } from 'vitest';

import { RATE } from '../stemPlayer/store.test-helper.ts';
import {
  BARS,
  fakeSongRuntime,
  SONG_ID,
  songRecord,
  songStore,
} from './store.test-helper.ts';
import { STORED_LENGTH_TOLERANCE_SEC } from './store.ts';

const STORED_SEC = 56;
const DECODED_SEC = 287;

async function opened(storedSec: number, decodedFrames: number) {
  const fake = fakeSongRuntime(songRecord({ durationSec: storedSec }));
  fake.commands.mixerTrackFrames.mockResolvedValue(decodedFrames);
  const store = songStore(fake);
  await store.getState().open(SONG_ID, BARS).loaded;
  return fake;
}

describe('the stored song length', () => {
  it('is corrected to the decoded length when they differ', async () => {
    const { library } = await opened(STORED_SEC, DECODED_SEC * RATE);
    expect(library.correctDuration).toHaveBeenCalledExactlyOnceWith(
      SONG_ID,
      DECODED_SEC,
    );
  });

  it('is left alone when it is within tolerance of the decoded length', async () => {
    const nearSec = DECODED_SEC + STORED_LENGTH_TOLERANCE_SEC / 2;
    const { library } = await opened(nearSec, DECODED_SEC * RATE);
    expect(library.correctDuration).not.toHaveBeenCalled();
  });

  it('is left alone when the mixer reads no length', async () => {
    const { library } = await opened(STORED_SEC, 0);
    expect(library.correctDuration).not.toHaveBeenCalled();
  });

  it('is left alone when the song closes before the length read lands', async () => {
    const fake = fakeSongRuntime(songRecord({ durationSec: STORED_SEC }));
    let finish: (frames: number) => void = () => undefined;
    fake.commands.mixerTrackFrames.mockImplementationOnce(
      () =>
        new Promise<number>((resolve) => {
          finish = resolve;
        }),
    );
    const store = songStore(fake);
    const { loaded } = store.getState().open(SONG_ID, BARS);
    await vi.waitFor(() => {
      expect(fake.commands.mixerTrackFrames).toHaveBeenCalled();
    });
    store.getState().close();
    finish(DECODED_SEC * RATE);
    await loaded;
    expect(fake.library.correctDuration).not.toHaveBeenCalled();
  });
});
