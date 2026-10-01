import { KB_SOUND_NAMES } from '@kitbag/core-native';
import type { PerAccentSounds } from '@kitbag/core-state';

export const SOUND_ROLE = { normal: 'normal', accent: 'accent' } as const;
export type SoundRole = (typeof SOUND_ROLE)[keyof typeof SOUND_ROLE];

export const SOUND_ROLE_OPTIONS = [
  { value: SOUND_ROLE.normal, label: 'Normal' },
  { value: SOUND_ROLE.accent, label: 'Accent' },
] as const;

const DISPLAY_NAMES: Partial<Record<string, string>> = { hihat: 'Hi-hat' };

function displayName(name: string): string {
  return DISPLAY_NAMES[name] ?? name.charAt(0).toUpperCase() + name.slice(1);
}

export const SOUND_OPTIONS = KB_SOUND_NAMES.map((name, id) => ({
  value: String(id),
  label: displayName(name),
}));

export function soundLabel(id: number): string {
  const name = KB_SOUND_NAMES[id];
  return name === undefined ? 'Sound' : displayName(name);
}

export function soundsWith(
  sounds: PerAccentSounds,
  role: SoundRole,
  id: number,
): PerAccentSounds {
  return role === SOUND_ROLE.accent
    ? { ...sounds, accent: id }
    : { ...sounds, normal: id };
}

export function soundChipLabel(sounds: PerAccentSounds): string {
  if (sounds.normal === sounds.accent) return soundLabel(sounds.normal);
  return `${soundLabel(sounds.normal)} · ${soundLabel(sounds.accent)}`;
}
