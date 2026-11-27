import { KB_DENOMINATORS } from '@kitbag/core-native';
import type { StoreApi } from 'zustand/vanilla';

import { libraryStore, type LibraryStore } from '../library/store.ts';
import { debounce } from '../debounce.ts';
import { rangeRamp, usesSound, withoutSound } from './config.ts';
import {
  applyMetronomeSettings,
  standaloneMetronomeChanged,
  standaloneMetronomeOf,
  type MetronomeSettingsInput,
  type StandaloneMetronome,
} from './standalone.ts';
import { initialConfig, metronomeStore, type MetronomeStore } from './store.ts';

export const STANDALONE_METRONOME_SAVE_DELAY_MS = 600;

export interface StandaloneMetronomePersistence {
  readonly load: () => Partial<MetronomeSettingsInput>;
  readonly save: (settings: StandaloneMetronome) => void;
}

export interface StandaloneMetronomeBinding {
  readonly flush: () => void;
  readonly unbind: () => void;
}

function storedSettings(
  persistence: StandaloneMetronomePersistence,
): Partial<MetronomeSettingsInput> | undefined {
  const { ramp, ...stored } = persistence.load();
  const safeRamp = ramp === undefined ? undefined : rangeRamp(ramp);
  if (Object.keys(stored).length === 0 && safeRamp === undefined)
    return undefined;
  return { ...stored, ...(safeRamp === undefined ? {} : { ramp: safeRamp }) };
}

function restore(
  metronome: StoreApi<MetronomeStore>,
  persistence: StandaloneMetronomePersistence,
): void {
  const stored = storedSettings(persistence);
  if (stored === undefined) return;
  const state = metronome.getState();
  applyMetronomeSettings(state, { ...standaloneMetronomeOf(state), ...stored });
}

export function bindStandaloneMetronomePersistence(
  metronome: StoreApi<MetronomeStore>,
  library: StoreApi<LibraryStore>,
  persistence: StandaloneMetronomePersistence,
): StandaloneMetronomeBinding {
  restore(metronome, persistence);
  const write = debounce(persistence.save, STANDALONE_METRONOME_SAVE_DELAY_MS);
  let queued = false;
  const capture = () => {
    if (!queued) return;
    queued = false;
    if (library.getState().loaded !== null) return;
    write(standaloneMetronomeOf(metronome.getState()));
  };
  // Deferred because a song load applies the preset before it sets `loaded`;
  // by the capture the change reads as the song's, not the standalone's.
  const schedule = () => {
    if (queued) return;
    queued = true;
    queueMicrotask(capture);
  };
  const flush = () => {
    capture();
    write.flush();
  };
  const unbindMetronome = metronome.subscribe((next, prev) => {
    if (standaloneMetronomeChanged(next, prev)) schedule();
  });
  const unbindLibrary = library.subscribe((next, prev) => {
    if (next.loaded === null && prev.loaded !== null) schedule();
  });
  return {
    flush,
    unbind: () => {
      flush();
      unbindMetronome();
      unbindLibrary();
    },
  };
}

let binding: StandaloneMetronomeBinding | undefined;
let configured: StandaloneMetronomePersistence | undefined;

export function configureStandaloneMetronomePersistence(
  persistence: StandaloneMetronomePersistence,
): () => void {
  if (binding !== undefined) {
    throw new Error('Standalone metronome persistence is already configured');
  }
  configured = persistence;
  binding = bindStandaloneMetronomePersistence(
    metronomeStore,
    libraryStore,
    persistence,
  );
  return binding.unbind;
}

export function flushStandaloneMetronomePersistence(): void {
  binding?.flush();
}

export function reloadStandaloneMetronomePersistence(): void {
  if (configured === undefined) return;
  const stored = storedSettings(configured);
  const state = metronomeStore.getState();
  const base = stored === undefined ? initialConfig() : state;
  applyMetronomeSettings(state, { ...standaloneMetronomeOf(base), ...stored });
  binding?.flush();
}

export function releaseStandaloneSound(soundId: number): void {
  if (configured === undefined) return;
  binding?.flush();
  const stored = storedSettings(configured);
  if (stored?.sounds === undefined || !usesSound(stored.sounds, soundId))
    return;
  const base = standaloneMetronomeOf(initialConfig());
  configured.save({
    ...base,
    ...stored,
    denominator:
      KB_DENOMINATORS.find((value) => value === stored.denominator) ??
      base.denominator,
    sounds: withoutSound(stored.sounds, soundId),
  });
}
