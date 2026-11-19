import { desc, eq, max } from 'drizzle-orm';

import type { Database } from './repository';
import { stems, stemSets } from './schema';
import type { ExistingStemSet } from './stem-bundle-repository';
import { STEM_SET_SOURCE } from './stem-set-source';

export const SAME_SONG_DURATION_TOLERANCE_SEC = 2;

export interface StemSetIdentity {
  readonly title: string;
  readonly artist: string | null;
  readonly durationSec: number;
}

interface Candidate {
  readonly title: string;
  readonly songTitle: string | null;
  readonly artist: string | null;
  readonly durationSec: number | null;
}

function folded(text: string | null): string {
  return (text ?? '').trim().toLowerCase();
}

function sameSong(identity: StemSetIdentity, candidate: Candidate): boolean {
  const title = folded(identity.title);
  return (
    (folded(candidate.title) === title ||
      folded(candidate.songTitle) === title) &&
    folded(candidate.artist) === folded(identity.artist) &&
    candidate.durationSec !== null &&
    Math.abs(candidate.durationSec - identity.durationSec) <=
      SAME_SONG_DURATION_TOLERANCE_SEC
  );
}

export async function findStemSetMatches(
  db: Database,
  identity: StemSetIdentity,
): Promise<ExistingStemSet[]> {
  if (folded(identity.title) === '') return [];
  const rows = await db
    .select({
      id: stemSets.id,
      title: stemSets.name,
      songTitle: stemSets.songTitle,
      artist: stemSets.artist,
      durationSec: max(stems.duration),
    })
    .from(stemSets)
    .innerJoin(stems, eq(stems.stemSetId, stemSets.id))
    .where(eq(stemSets.source, STEM_SET_SOURCE.stemdeck))
    .groupBy(stemSets.id)
    .orderBy(desc(stemSets.id));
  return rows
    .filter((row) => sameSong(identity, row))
    .map(({ id, title }) => ({ id, title }));
}
