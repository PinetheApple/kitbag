import { eq } from 'drizzle-orm';

import type { Database } from './repository';
import { stemSets } from './schema';

const RETIMED_LYRICS_VERSION = 1;

export type RetimedLyrics = readonly number[];

interface RetimedLyricsJson {
  readonly version: typeof RETIMED_LYRICS_VERSION;
  readonly times: RetimedLyrics;
}

function isRetimed(value: unknown): value is RetimedLyricsJson {
  if (typeof value !== 'object' || value === null) return false;
  const { version, times } = value as Record<string, unknown>;
  return (
    version === RETIMED_LYRICS_VERSION &&
    Array.isArray(times) &&
    times.every((time) => typeof time === 'number' && Number.isFinite(time))
  );
}

export function parseRetimedLyrics(text: string | null): RetimedLyrics | null {
  if (text === null) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    return isRetimed(parsed) ? parsed.times : null;
  } catch {
    return null;
  }
}

function encodeRetimedLyrics(times: RetimedLyrics | null): string | null {
  if (times === null) return null;
  const json: RetimedLyricsJson = { version: RETIMED_LYRICS_VERSION, times };
  return JSON.stringify(json);
}

export async function saveLyricsRetimed(
  db: Database,
  stemSetId: number,
  times: RetimedLyrics | null,
): Promise<void> {
  await db
    .update(stemSets)
    .set({ lyricsRetimed: encodeRetimedLyrics(times) })
    .where(eq(stemSets.id, stemSetId));
}
