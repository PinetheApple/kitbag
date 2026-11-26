import type { SongIdentity } from '@kitbag/core-db';

import { withTimeout } from './http.ts';
import { matchLibrary, type LibraryMatch } from './libraryMatch.ts';
import type { TempoLadderRuntime } from './runtime.ts';
import { BPM_SOURCE, type BpmSource, type LadderRung } from './sources.ts';

export interface TempoLookup {
  readonly bpm: number | null;
  readonly source: BpmSource | null;
  readonly tried: readonly LadderRung[];
  readonly libraryMatch: LibraryMatch | null;
}

const NOTHING = { bpm: null, source: null, libraryMatch: null } as const;

async function attempt<T>(
  tried: LadderRung[],
  rung: LadderRung,
  work: () => Promise<T | null>,
): Promise<T | null> {
  tried.push(rung);
  try {
    return await work();
  } catch {
    return null;
  }
}

async function lookUpOnline(
  song: SongIdentity,
  runtime: TempoLadderRuntime,
  tried: LadderRung[],
): Promise<TempoLookup> {
  for (const { id: source, lookUp } of runtime.onlineSources()) {
    const bpm = await attempt(tried, source, () =>
      withTimeout((signal) => lookUp(song, signal)),
    );
    if (bpm === null) continue;
    await runtime.cache.put(song, { bpm, source }).catch(() => undefined);
    return { ...NOTHING, bpm, source, tried };
  }
  return { ...NOTHING, tried };
}

export async function climbLadder(
  song: SongIdentity,
  runtime: TempoLadderRuntime,
): Promise<TempoLookup> {
  const tried: LadderRung[] = [];
  if (song.title.trim() === '') return { ...NOTHING, tried };
  const libraryMatch = await attempt(tried, BPM_SOURCE.library, async () =>
    matchLibrary(song, await runtime.library.list()),
  );
  if (libraryMatch !== null) {
    return {
      bpm: libraryMatch.bpm,
      source: BPM_SOURCE.library,
      tried,
      libraryMatch,
    };
  }
  const cached = await runtime.cache.get(song).catch(() => null);
  if (cached !== null) return { ...NOTHING, ...cached, tried };
  return lookUpOnline(song, runtime, tried);
}
