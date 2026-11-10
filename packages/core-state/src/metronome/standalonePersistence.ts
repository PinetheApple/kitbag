import type { StoreApi } from 'zustand/vanilla';

import { libraryStore, type LibraryStore } from '../library/store.ts';
import { rangeRamp } from './config.ts';
import {
  applyMetronomeSettings,
  standaloneMetronomeChanged,
  standaloneMetronomeOf,
  type MetronomeSettingsInput,
  type StandaloneMetronome,
} from './standalone.ts';
import { metronomeStore, type MetronomeStore } from './store.ts';

export interface StandaloneMetronomePersistence {
  readonly load: () => Partial<MetronomeSettingsInput>;
  readonly save: (settings: StandaloneMetronome) => void;
}

function restore(
  metronome: StoreApi<MetronomeStore>,
  persistence: StandaloneMetronomePersistence,
): void {
  const { ramp, ...stored } = persistence.load();
  const safeRamp = ramp === undefined ? undefined : rangeRamp(ramp);
  if (Object.keys(stored).length === 0 && safeRamp === undefined) return;
  const state = metronome.getState();
  applyMetronomeSettings(state, {
    ...standaloneMetronomeOf(state),
    ...stored,
    ...(safeRamp === undefined ? {} : { ramp: safeRamp }),
  });
}

export function bindStandaloneMetronomePersistence(
  metronome: StoreApi<MetronomeStore>,
  library: StoreApi<LibraryStore>,
  persistence: StandaloneMetronomePersistence,
): () => void {
  restore(metronome, persistence);
  let pending = false;
  const flush = () => {
    pending = false;
    if (library.getState().loaded !== null) return;
    persistence.save(standaloneMetronomeOf(metronome.getState()));
  };
  // Deferred because a song load applies the preset before it sets `loaded`;
  // by the flush the change reads as the song's, not the standalone's.
  const schedule = () => {
    if (pending) return;
    pending = true;
    queueMicrotask(flush);
  };
  const unbindMetronome = metronome.subscribe((next, prev) => {
    if (standaloneMetronomeChanged(next, prev)) schedule();
  });
  const unbindLibrary = library.subscribe((next, prev) => {
    if (next.loaded === null && prev.loaded !== null) schedule();
  });
  return () => {
    unbindMetronome();
    unbindLibrary();
  };
}

let unbind: (() => void) | undefined;

export function configureStandaloneMetronomePersistence(
  persistence: StandaloneMetronomePersistence,
): () => void {
  if (unbind !== undefined) {
    throw new Error('Standalone metronome persistence is already configured');
  }
  unbind = bindStandaloneMetronomePersistence(
    metronomeStore,
    libraryStore,
    persistence,
  );
  return unbind;
}
