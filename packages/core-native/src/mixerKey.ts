import {
  KB_MIXER_PITCH_BOUNDS,
  KB_RESULT,
} from './generated/nativeConstants.gen.ts';
import type { Spec } from './NativeKitbagCommands';

export type TrackKeyCommands = Pick<Spec, 'mixerSetTrackPitch'>;

// Half away from zero, so a key and its opposite stay opposite; Math.round alone sends -2.5 to -2.
const wholeSemitones = (stored: number) =>
  Math.sign(stored) * Math.round(Math.abs(stored));

const inRange = (semitones: number) =>
  semitones >= KB_MIXER_PITCH_BOUNDS.min &&
  semitones <= KB_MIXER_PITCH_BOUNDS.max;

// NaN must stop here: the module's Double.toInt() would turn it into a valid key of 0.
export function setTrackKey(
  commands: TrackKeyCommands,
  track: number,
  storedSemitones: number,
): Promise<number> {
  const semitones = wholeSemitones(storedSemitones);
  if (!inRange(semitones)) {
    return Promise.resolve(KB_RESULT.KB_ERROR_INVALID_ARGUMENT);
  }
  return commands.mixerSetTrackPitch(track, semitones);
}
