import { KB_DEFAULT_SOUNDS, KB_SOUND_NAMES } from '@kitbag/core-native';

export const BUILT_IN_SOUND_NAMES: readonly string[] = KB_SOUND_NAMES.map(
  (name) => name.charAt(0).toUpperCase() + name.slice(1),
);

export const DEFAULT_SOUND_NAME =
  BUILT_IN_SOUND_NAMES[KB_DEFAULT_SOUNDS.normal] ?? '';
