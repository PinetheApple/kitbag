import type { SongFiles } from '@kitbag/core-db';
import { KB_BEAT_ANALYSIS_VERSION } from '@kitbag/core-native';

import type { SongLibraryRecords } from './runtime.ts';
import { warn } from './storeSupport.ts';

export interface OutdatedGridQueue {
  readonly resume: () => Promise<void>;
  readonly settled: (filePath: string) => Promise<void>;
}

// The database is the queue: a song leaves it once a result stamps the current
// version, or a failure leaves it 'failed', which is never re-queued here.
export function outdatedGridQueue(
  records: () => SongLibraryRecords,
  requeue: (songId: number) => Promise<SongFiles | undefined>,
): OutdatedGridQueue {
  let running: string | null = null;
  let chain = Promise.resolve();
  const startNext = async () => {
    running = null;
    try {
      const outdated = await records().listOutdatedAnalyses(
        KB_BEAT_ANALYSIS_VERSION,
      );
      for (const songId of outdated) {
        const song = await requeue(songId);
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
  };
}
