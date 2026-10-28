import type { LibraryConstants } from '@kitbag/core-native';
import type { StoreApi } from 'zustand/vanilla';

import type { Removal } from './logic.ts';
import type { LibraryFiles } from './runtime.ts';
import type { SongLibraryDeps, SongLibraryStore } from './store.ts';

export type SetState = StoreApi<SongLibraryStore>['setState'];
export type Get = StoreApi<SongLibraryStore>['getState'];

export function warn(what: string, error: unknown) {
  console.warn(`[kitbag] ${what}`, error);
}

// Leftovers belong to a row that is already gone or a waveform already
// replaced; failing to remove them only costs space, never the row's state.
export async function deleteLeftovers(
  files: LibraryFiles,
  removals: readonly Removal[],
  label: string,
): Promise<void> {
  try {
    for (const removal of removals) {
      if (removal.kind === 'folder') await files.deleteSongFolder(removal.name);
      else if (removal.kind === 'stemFolder')
        await files.deleteStemFolder(removal.name);
      else await files.deleteLibraryFile(removal.path);
    }
  } catch (error) {
    warn(`files of ${label} were not all deleted`, error);
  }
}

// Read once, and only when first needed: without the native module (web) there
// are none, and rows then show their failures without a specific cause.
export function loadCodes(
  deps: SongLibraryDeps,
  get: Get,
): LibraryConstants | null {
  const known = get().codes;
  if (known !== null) return known;
  try {
    return deps.files().constants();
  } catch (error) {
    warn('library constants unavailable', error);
    return null;
  }
}

export function withoutOne(names: readonly string[], name: string): string[] {
  const at = names.indexOf(name);
  return at < 0 ? [...names] : [...names.slice(0, at), ...names.slice(at + 1)];
}

export async function whileImporting<T>(
  set: SetState,
  get: Get,
  name: string,
  work: () => Promise<T>,
): Promise<T> {
  set({ importing: [...get().importing, name] });
  try {
    return await work();
  } finally {
    set({ importing: withoutOne(get().importing, name) });
  }
}
