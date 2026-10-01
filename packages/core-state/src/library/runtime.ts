import type { SetlistRepository, SongPresetRepository } from '@kitbag/core-db';

export interface LibraryRepositories {
  readonly setlists: SetlistRepository;
  readonly presets: SongPresetRepository;
}

let configured: LibraryRepositories | undefined;

export function configureLibrary(repositories: LibraryRepositories): void {
  if (configured === undefined) {
    configured = repositories;
    return;
  }
  if (configured !== repositories) {
    throw new Error('Library repositories are already configured');
  }
}

export function getLibrary(): LibraryRepositories {
  if (configured === undefined) {
    throw new Error('Library repositories are not configured');
  }
  return configured;
}
