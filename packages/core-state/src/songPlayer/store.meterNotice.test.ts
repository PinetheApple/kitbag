import {
  NO_METER_OVERRIDE,
  type LibraryRow,
  type SongRecord,
} from '@kitbag/core-db';
import { describe, expect, it, vi } from 'vitest';
import { createStore } from 'zustand/vanilla';

import { songRow } from '../storage/fixtures.test-helper.ts';
import {
  BARS,
  fakeSongRuntime,
  SONG_ID,
  songRecord,
  songStore,
} from './store.test-helper.ts';

const BEATS = [0, 0.5, 1, 1.5, 2, 2.5, 3, 3.5];
const BAR_ONE_ON_SECOND_BEAT = { ...NO_METER_OVERRIDE, barOneSeconds: 0.5 };
const FIRST = songRecord({ beats: BEATS, downbeatIndices: [0, 4] });
const OVERRIDDEN = { ...FIRST, ...BAR_ONE_ON_SECOND_BEAT };

async function opened(first: SongRecord) {
  const fake = fakeSongRuntime(first);
  const library = createStore(() => ({
    rows: [songRow({ id: SONG_ID })] as readonly LibraryRow[],
    ready: true,
    failed: false,
  }));
  const player = songStore(fake, undefined, library);
  await player.getState().open(SONG_ID, BARS).loaded;
  return { ...fake, library, player };
}

type Opened = Awaited<ReturnType<typeof opened>>;

async function reread(song: Opened, record: SongRecord) {
  const reads = song.records.readSong.mock.calls.length;
  song.records.readSong.mockResolvedValue(record);
  song.library.setState({ rows: [songRow({ id: SONG_ID })] });
  await vi.waitFor(() => {
    expect(song.records.readSong.mock.calls.length).toBeGreaterThan(reads);
  });
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('the re-analysis notice', () => {
  it('appears when the new grid disagrees with the override', async () => {
    const song = await opened(OVERRIDDEN);
    await reread(song, { ...OVERRIDDEN, downbeatIndices: [2, 6] });
    expect(song.player.getState().meterNotice).toEqual({
      meter: 4,
      barOneSeconds: 1,
    });
  });

  it('stays away when the new grid agrees with the override', async () => {
    const song = await opened(OVERRIDDEN);
    await reread(song, { ...OVERRIDDEN, downbeatIndices: [1, 5] });
    expect(song.player.getState().detected.barOneSeconds).toBe(0.5);
    expect(song.player.getState().meterNotice).toBeNull();
  });

  it('stays away on a library refresh that leaves the grid alone', async () => {
    const song = await opened(OVERRIDDEN);
    await reread(song, OVERRIDDEN);
    expect(song.player.getState().meterNotice).toBeNull();
  });

  it('stays away when the song has no override', async () => {
    const song = await opened(FIRST);
    await reread(song, { ...FIRST, downbeatIndices: [2, 6, BEATS.length] });
    expect(song.player.getState().detected.barOneSeconds).toBe(1);
    expect(song.player.getState().meterNotice).toBeNull();
  });

  it('is cleared by any change the user makes', async () => {
    const song = await opened(OVERRIDDEN);
    await reread(song, { ...OVERRIDDEN, downbeatIndices: [2, 6] });
    song.player.getState().meterOverrideChanged(SONG_ID, NO_METER_OVERRIDE);
    expect(song.player.getState().meterNotice).toBeNull();
  });
});

describe('a library refresh while a change is still saving', () => {
  it('shows the stored bars, then the saved ones once they are stored', async () => {
    const song = await opened(FIRST);
    song.player
      .getState()
      .meterOverrideChanged(SONG_ID, BAR_ONE_ON_SECOND_BEAT);
    expect(song.player.getState().downbeatIndices).toEqual([1, 5]);
    await reread(song, FIRST);
    expect(song.player.getState()).toMatchObject({
      meterOverride: NO_METER_OVERRIDE,
      downbeatIndices: [0, 4],
    });
    await reread(song, OVERRIDDEN);
    expect(song.player.getState()).toMatchObject({
      meterOverride: BAR_ONE_ON_SECOND_BEAT,
      downbeatIndices: [1, 5],
    });
  });
});
