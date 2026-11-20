import { describe, expect, it, vi } from 'vitest';

import { ADVANCE_CAUSE, ADVANCE_OUTCOME } from '../stemPlayer/songEnd.ts';
import { RATE } from '../stemPlayer/store.test-helper.ts';
import { secondsToFrames } from '../stemPlayer/time.ts';
import {
  BARS,
  fakeSongRuntime,
  leftPlaying,
  settle,
  SONG_ID,
  songRecord,
  songStore,
} from './store.test-helper.ts';

const NEXT = { action: 'next', frame: null } as const;
const NEXT_SONG = SONG_ID + 1;
const SONG_END = secondsToFrames(songRecord().durationSec, RATE);

describe('a single song in the play order', () => {
  it('shows a card that follows the play order', async () => {
    const left = await leftPlaying();
    expect(left.commands.songTransportShow).toHaveBeenLastCalledWith(
      expect.objectContaining({ followsPlayOrder: true }),
    );
  });

  it('tells the play order when it ends', async () => {
    const left = await leftPlaying();
    const advance = vi.fn();
    left.player.getState().onSongEnd(advance);
    left.endSong(SONG_END);
    expect(advance).toHaveBeenCalledExactlyOnceWith(ADVANCE_CAUSE.ended);
    expect(left.player.getState().songStillEnded()).toBe(true);
  });

  it('passes Next on its card to the play order', async () => {
    const left = await leftPlaying();
    const advance = vi.fn();
    left.player.getState().onSongEnd(advance);
    left.requestFromNotification(NEXT);
    expect(advance).toHaveBeenCalledExactlyOnceWith(ADVANCE_CAUSE.next);
  });

  it('hands over with its card kept up, letting the engine go after', async () => {
    const left = await leftPlaying();
    left.commands.songTransportHide.mockClear();
    left.player.getState().handOver();
    expect(left.player.getState().status).toBe('idle');
    expect(left.commands.songTransportHide).not.toHaveBeenCalled();
    expect(left.commands.engineRelease).not.toHaveBeenCalled();
    await settle();
    expect(left.commands.engineRelease).toHaveBeenCalledOnce();
  });

  it('takes over from another player and plays the song', async () => {
    const fake = fakeSongRuntime();
    const player = songStore(fake);
    expect(await player.getState().takeOver(SONG_ID, BARS)).toBe(
      ADVANCE_OUTCOME.playing,
    );
    expect(player.getState()).toMatchObject({
      songId: SONG_ID,
      status: 'ready',
    });
    expect(fake.commands.songTransportShow).toHaveBeenCalledWith(
      expect.objectContaining({ title: songRecord().title }),
    );
  });

  it('lets the play order move on from a song that will not open, then gives up', async () => {
    const fake = fakeSongRuntime();
    fake.records.readSong.mockResolvedValue(undefined);
    const player = songStore(fake);
    expect(await player.getState().takeOver(SONG_ID, BARS)).toBe(
      ADVANCE_OUTCOME.unplayable,
    );
    expect(player.getState().songStillEnded()).toBe(true);
    player.getState().stopAdvancing();
    expect(player.getState().status).toBe('idle');
  });

  it('takes the next single song over from itself, holding the engine before letting go', async () => {
    const left = await leftPlaying();
    const { engineHold, engineRelease, songTransportHide } = left.commands;
    engineHold.mockClear();
    engineRelease.mockClear();
    left.player.getState().handOver();
    expect(await left.player.getState().takeOver(NEXT_SONG, BARS)).toBe(
      ADVANCE_OUTCOME.playing,
    );
    expect(left.player.getState().songId).toBe(NEXT_SONG);
    expect(engineHold).toHaveBeenCalledOnce();
    expect(engineRelease).toHaveBeenCalledOnce();
    expect(engineHold.mock.invocationCallOrder[0]).toBeLessThan(
      engineRelease.mock.invocationCallOrder[0] ?? 0,
    );
    expect(songTransportHide).not.toHaveBeenCalled();
  });
});
