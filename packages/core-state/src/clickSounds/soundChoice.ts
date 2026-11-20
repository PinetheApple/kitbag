import { customSoundId, isCustomSoundId } from '@kitbag/core-native';
import type { ClickSound } from '@kitbag/core-db';

import type { PerAccentSounds } from '../metronome/config.ts';
import { BUILT_IN_SOUND_NAMES, DEFAULT_SOUND_NAME } from './soundNames.ts';

export const SOUND_ROLE = { normal: 'normal', accent: 'accent' } as const;
export type SoundRole = (typeof SOUND_ROLE)[keyof typeof SOUND_ROLE];
export const SOUND_ROLES: readonly SoundRole[] = [
  SOUND_ROLE.normal,
  SOUND_ROLE.accent,
];

export function soundRoleName(role: SoundRole): string {
  return role === SOUND_ROLE.accent ? 'Accent' : 'Normal';
}

export const SOUND_ROLE_OPTIONS = [
  { value: SOUND_ROLE.normal, label: soundRoleName(SOUND_ROLE.normal) },
  { value: SOUND_ROLE.accent, label: soundRoleName(SOUND_ROLE.accent) },
] as const;

export const SOUND_OPTIONS = BUILT_IN_SOUND_NAMES.map((label, id) => ({
  value: String(id),
  label,
}));

export interface CustomSoundView {
  readonly id: number;
  readonly sound: ClickSound;
  readonly available: boolean;
}

export function customSoundViews(
  sounds: readonly ClickSound[],
  unavailable: readonly number[],
): CustomSoundView[] {
  return sounds.map((sound) => ({
    id: customSoundId(sound.slot),
    sound,
    available: !unavailable.includes(sound.slot),
  }));
}

export function soundLabel(
  id: number,
  custom: readonly CustomSoundView[] = [],
): string {
  const builtIn = BUILT_IN_SOUND_NAMES[id];
  if (builtIn !== undefined) return builtIn;
  if (!isCustomSoundId(id)) return 'Sound';
  const view = custom.find((candidate) => candidate.id === id);
  return view?.available === true ? view.sound.name : DEFAULT_SOUND_NAME;
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

export function rolesUsing(sounds: PerAccentSounds, id: number): SoundRole[] {
  return SOUND_ROLES.filter((role) => sounds[role] === id);
}

export function soundChipLabel(
  sounds: PerAccentSounds,
  custom: readonly CustomSoundView[] = [],
): string {
  const normal = soundLabel(sounds.normal, custom);
  const accent = soundLabel(sounds.accent, custom);
  return normal === accent ? normal : `${normal} · ${accent}`;
}
