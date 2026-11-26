import {
  artistCredits,
  songMatchText,
  type SongIdentity,
} from '@kitbag/core-db';

export const MATCH_THRESHOLD = 0.8;
const SHARED_CREDIT_WEIGHT = 0.9;

function words(text: string): string[] {
  return text.split(' ').filter((word) => word !== '');
}

function sharedWordScore(left: string, right: string): number {
  const ours = words(left);
  const theirs = words(right);
  if (ours.length === 0 || theirs.length === 0) return 0;
  const pool = [...theirs];
  const shared = ours.filter((word) => {
    const at = pool.indexOf(word);
    if (at >= 0) pool.splice(at, 1);
    return at >= 0;
  }).length;
  return (2 * shared) / (ours.length + theirs.length);
}

function artistScore(query: string, candidate: string): number {
  const theirs = artistCredits(candidate);
  const creditScores = artistCredits(query).flatMap((ours) =>
    theirs.map((their) => sharedWordScore(ours, their) * SHARED_CREDIT_WEIGHT),
  );
  const whole = sharedWordScore(songMatchText(query), songMatchText(candidate));
  return Math.max(whole, ...creditScores);
}

export function songMatchScore(
  query: SongIdentity,
  candidate: SongIdentity,
): number {
  const title = sharedWordScore(
    songMatchText(query.title),
    songMatchText(candidate.title),
  );
  return Math.min(title, artistScore(query.artist, candidate.artist));
}

export function rankMatches<T extends SongIdentity>(
  query: SongIdentity,
  candidates: readonly T[],
): T[] {
  return candidates
    .map((candidate) => ({
      candidate,
      score: songMatchScore(query, candidate),
    }))
    .filter(({ score }) => score >= MATCH_THRESHOLD)
    .sort((a, b) => b.score - a.score)
    .map(({ candidate }) => candidate);
}
