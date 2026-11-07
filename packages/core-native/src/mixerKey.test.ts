import { describe, expect, it, vi } from 'vitest';

import {
  KB_MIXER_PITCH_BOUNDS,
  KB_RESULT,
} from './generated/nativeConstants.gen.ts';
import { setTrackKey, type TrackKeyCommands } from './mixerKey.ts';

const TRACK = 3;
const { min: MIN, max: MAX } = KB_MIXER_PITCH_BOUNDS;

function fakeCommands(result: number = KB_RESULT.KB_OK) {
  return {
    mixerSetTrackPitch: vi.fn<TrackKeyCommands['mixerSetTrackPitch']>(() =>
      Promise.resolve(result),
    ),
  };
}

describe('setTrackKey', () => {
  it.each([
    [0, 0],
    [2, 2],
    [1.4, 1],
    [1.6, 2],
    [2.5, 3],
    [-1.4, -1],
    [-1.6, -2],
    [-2.5, -3],
    [MAX, MAX],
    [MIN, MIN],
    [MAX + 0.4, MAX],
    [MIN - 0.4, MIN],
  ])('sends a stored %d as the whole semitone %d', async (stored, sent) => {
    const commands = fakeCommands();
    await expect(setTrackKey(commands, TRACK, stored)).resolves.toBe(
      KB_RESULT.KB_OK,
    );
    expect(commands.mixerSetTrackPitch.mock.calls).toEqual([[TRACK, sent]]);
  });

  it('sends a value that rounds to no key as an integer zero', async () => {
    const commands = fakeCommands();
    await setTrackKey(commands, TRACK, -0.4);
    const sent = commands.mixerSetTrackPitch.mock.calls[0]?.[1];
    expect(sent).toBe(0);
  });

  it.each([
    ['NaN', Number.NaN],
    ['infinity', Number.POSITIVE_INFINITY],
    ['negative infinity', Number.NEGATIVE_INFINITY],
    ['just over the top', MAX + 1],
    ['just under the bottom', MIN - 1],
    ['rounding over the top', MAX + 0.5],
    ['rounding under the bottom', MIN - 0.5],
  ])('rejects %s without reaching the engine', async (_name, stored) => {
    const commands = fakeCommands();
    await expect(setTrackKey(commands, TRACK, stored)).resolves.toBe(
      KB_RESULT.KB_ERROR_INVALID_ARGUMENT,
    );
    expect(commands.mixerSetTrackPitch).not.toHaveBeenCalled();
  });

  it.each([KB_RESULT.KB_ERROR_BUSY, KB_RESULT.KB_ERROR_INTERNAL])(
    'hands back the engine result %d',
    async (result) => {
      await expect(setTrackKey(fakeCommands(result), TRACK, 1)).resolves.toBe(
        result,
      );
    },
  );
});
