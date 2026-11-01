import {
  getBackup,
  libraryStore,
  songLibraryStore,
  tunerStore,
} from '@kitbag/core-state';
import { expect, it, vi } from 'vitest';

const service = vi.hoisted(() => ({ plan: vi.fn() }));

vi.mock('./database.ts', () => ({
  getDatabase: () => ({ backup: service }),
}));

await import('./backupRuntime.ts');

it('restores through the app database', () => {
  expect(getBackup().service()).toBe(service);
});

it('reloads setlists, library songs and tunings after a restore', async () => {
  const refresh = vi.fn(() => Promise.resolve());
  const refreshSongs = vi.fn(() => Promise.resolve());
  const loadCustomTunings = vi.fn(() => Promise.resolve());
  libraryStore.setState({ refresh });
  songLibraryStore.setState({ refresh: refreshSongs });
  tunerStore.setState({ loadCustomTunings });

  await getBackup().afterRestore();

  expect(refresh).toHaveBeenCalledOnce();
  expect(refreshSongs).toHaveBeenCalledOnce();
  expect(loadCustomTunings).toHaveBeenCalledOnce();
});
