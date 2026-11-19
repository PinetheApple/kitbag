import type { SongFiles } from '@kitbag/core-db';
import { KB_BEAT_ANALYSIS_VERSION } from '@kitbag/core-native';

import type { SongLibraryDeps } from './store.ts';
import { enqueue, warn, type Get } from './storeSupport.ts';

export interface OutdatedGridQueue {
  readonly resume: () => Promise<void>;
  readonly settled: (filePath: string) => Promise<void>;
  readonly restart: () => Promise<void>;
}

export async function requeueAndRefresh(
  deps: SongLibraryDeps,
  get: Get,
  songId: number,
): Promise<SongFiles | undefined> {
  const song = await deps.records().beginAnalysis(songId);
  if (song !== undefined) enqueue(deps.files(), song, true);
  await get().refresh();
  return song;
}

// The database is the queue: a song leaves it once a result stamps the current
// version, or a failure leaves it 'failed', which is never re-queued here.
export function outdatedGridQueue(
  deps: SongLibraryDeps,
  get: Get,
): OutdatedGridQueue {
  const tried = new Set<number>();
  let running: string | null = null;
  let chain = Promise.resolve();
  const waiting = (songId: number) =>
    !tried.has(songId) && songId !== deps.openSong().id();
  const startNext = async () => {
    running = null;
    try {
      const outdated = await deps
        .records()
        .listOutdatedAnalyses(KB_BEAT_ANALYSIS_VERSION);
      for (const songId of outdated.filter(waiting)) {
        tried.add(songId);
        const song = await requeueAndRefresh(deps, get, songId);
        if (song === undefined) continue;
        running = song.filePath;
        return;
      }
    } catch (error) {
      warn('re-analysis of older grids stopped', error);
    }
  };
  const serially = (step: () => Promise<void>) => {
    chain = chain.then(step);
    return chain;
  };
  return {
    resume: () =>
      serially(async () => {
        if (running === null) await startNext();
      }),
    settled: (filePath: string) =>
      serially(async () => {
        if (filePath === running) await startNext();
      }),
    // An analysis enqueued while the card was out never ran, so nothing settles it.
    restart: () =>
      serially(async () => {
        tried.clear();
        await startNext();
      }),
  };
}
