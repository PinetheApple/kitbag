import type { SongIdentity } from '@kitbag/core-db';

import { withTimeout } from './http.ts';
import { matchLibrary, type LibraryMatch } from './libraryMatch.ts';
import type { OnlineBpmLookup } from './onlineBpmLookup.ts';
import type { TempoLadderRuntime } from './runtime.ts';
import { BPM_SOURCE, type BpmSource, type LadderRung } from './sources.ts';

export interface TempoLookup {
  readonly bpm: number | null;
  readonly source: BpmSource | null;
  readonly tried: readonly LadderRung[];
  readonly libraryMatch: LibraryMatch | null;
}

export const NO_TEMPO: TempoLookup = {
  bpm: null,
  source: null,
  tried: [],
  libraryMatch: null,
};

async function tryRung<T>(
  tried: LadderRung[],
  rung: LadderRung,
  work: () => Promise<T | null>,
): Promise<T | null> {
  if (!tried.includes(rung)) tried.push(rung);
  try {
    return await work();
  } catch {
    return null;
  }
}

function onlineLookupsOf(
  runtime: TempoLadderRuntime,
): readonly OnlineBpmLookup[] {
  try {
    return runtime.onlineLookups();
  } catch {
    return [];
  }
}

async function lookUpOnline(
  song: SongIdentity,
  runtime: TempoLadderRuntime,
  tried: LadderRung[],
): Promise<TempoLookup> {
  for (const { id: source, lookUp } of onlineLookupsOf(runtime)) {
    const bpm = await tryRung(tried, source, () =>
      withTimeout((signal) => lookUp(song, signal)),
    );
    if (bpm === null) continue;
    await runtime.cache.put(song, { bpm, source }).catch(() => undefined);
    return { ...NO_TEMPO, bpm, source, tried };
  }
  return { ...NO_TEMPO, tried };
}

export async function climbLadder(
  song: SongIdentity,
  runtime: TempoLadderRuntime,
): Promise<TempoLookup> {
  const tried: LadderRung[] = [];
  if (song.title.trim() === '') return { ...NO_TEMPO, tried };
  const libraryMatch = await tryRung(tried, BPM_SOURCE.library, async () =>
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
  if (cached !== null) return { ...NO_TEMPO, ...cached, tried };
  return lookUpOnline(song, runtime, tried);
}
