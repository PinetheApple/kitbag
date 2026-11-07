import {
  KB_MIXER_PITCH_BOUNDS,
  KB_RESULT,
} from './generated/nativeConstants.gen.ts';
import type { Spec } from './NativeKitbagCommands';

export type TrackKeyCommands = Pick<Spec, 'mixerSetTrackPitch'>;

// Half away from zero, so a key and its opposite stay opposite; Math.round alone sends -2.5 to -2.
const wholeSemitones = (stored: number) => {
  const magnitude = Math.round(Math.abs(stored));
  return stored < 0 && magnitude > 0 ? -magnitude : magnitude;
};

// NaN fails both comparisons, so it is refused with the rest.
const inRange = (semitones: number) =>
  semitones >= KB_MIXER_PITCH_BOUNDS.min &&
  semitones <= KB_MIXER_PITCH_BOUNDS.max;

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
