import type { ApplyReport, CategoryPlan } from '@kitbag/core-db';
import { customSoundId } from '@kitbag/core-native';
import type { StoreApi } from 'zustand/vanilla';

import { libraryStore, type LibraryStore } from '../library/store.ts';
import {
  usesSound,
  withoutSound,
  withSound,
  type PerAccentSounds,
} from '../metronome/config.ts';
import {
  releaseStandaloneSound,
  restoreStandaloneSound,
} from '../metronome/standalonePersistence.ts';
import { metronomeStore, type MetronomeStore } from '../metronome/store.ts';

export interface ReleasedSounds {
  readonly metronome: PerAccentSounds | null;
  readonly standalone: PerAccentSounds | null;
}

export function releaseSound(
  soundId: number,
  metronome: StoreApi<MetronomeStore> = metronomeStore,
): ReleasedSounds {
  const { sounds, setSounds } = metronome.getState();
  const used = usesSound(sounds, soundId);
  if (used) {
    const released = withoutSound(sounds, soundId);
    setSounds(released.normal, released.accent);
  }
  return {
    metronome: used ? sounds : null,
    standalone: releaseStandaloneSound(soundId),
  };
}

export async function releaseRemovedSound(
  soundId: number,
  metronome: StoreApi<MetronomeStore> = metronomeStore,
  library: StoreApi<Pick<LibraryStore, 'refresh'>> = libraryStore,
): Promise<ReleasedSounds> {
  const released = releaseSound(soundId, metronome);
  await library.getState().refresh();
  return released;
}

export async function restoreReleasedSound(
  soundId: number,
  released: ReleasedSounds,
  metronome: StoreApi<MetronomeStore> = metronomeStore,
  library: StoreApi<Pick<LibraryStore, 'refresh'>> = libraryStore,
): Promise<void> {
  if (released.metronome !== null) {
    const { sounds, setSounds } = metronome.getState();
    const back = withSound(sounds, released.metronome, soundId);
    setSounds(back.normal, back.accent);
  }
  if (released.standalone !== null)
    restoreStandaloneSound(soundId, released.standalone);
  await library.getState().refresh();
}

const wrote = (plan: CategoryPlan | undefined) =>
  plan !== undefined && plan.new + plan.updates > 0;

export function releaseStaleSounds(
  report: Pick<ApplyReport, 'counts' | 'staleSlots'>,
  metronome: StoreApi<MetronomeStore> = metronomeStore,
): void {
  const { restored, local } = report.staleSlots;
  const slots = wrote(report.counts.metronomeSettings) ? restored : local;
  for (const slot of slots) releaseSound(customSoundId(slot), metronome);
}
