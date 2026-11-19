import type { ApplyReport, CategoryPlan } from '@kitbag/core-db';
import { customSoundId } from '@kitbag/core-native';
import type { StoreApi } from 'zustand/vanilla';

import { libraryStore, type LibraryStore } from '../library/store.ts';
import { usesSound, withoutSound } from '../metronome/config.ts';
import { releaseStandaloneSound } from '../metronome/standalonePersistence.ts';
import { metronomeStore, type MetronomeStore } from '../metronome/store.ts';

export function releaseSound(
  soundId: number,
  metronome: StoreApi<MetronomeStore> = metronomeStore,
): void {
  const { sounds, setSounds } = metronome.getState();
  if (usesSound(sounds, soundId)) {
    const released = withoutSound(sounds, soundId);
    setSounds(released.normal, released.accent);
  }
  releaseStandaloneSound(soundId);
}

export async function releaseRemovedSound(
  soundId: number,
  metronome: StoreApi<MetronomeStore> = metronomeStore,
  library: StoreApi<Pick<LibraryStore, 'refresh'>> = libraryStore,
): Promise<void> {
  releaseSound(soundId, metronome);
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
