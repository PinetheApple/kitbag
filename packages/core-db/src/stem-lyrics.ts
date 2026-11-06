import { eq } from 'drizzle-orm';

import type { Database } from './repository';
import { stemSets } from './schema';

const RETIMED_LYRICS_VERSION = 1;

export type LyricLineTimes = readonly number[];

interface RetimedLyricsJson {
  readonly version: typeof RETIMED_LYRICS_VERSION;
  readonly times: LyricLineTimes;
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

export function parseRetimedLyrics(text: string | null): LyricLineTimes | null {
  if (text === null) return null;
  try {
    const parsed: unknown = JSON.parse(text);
    return isRetimed(parsed) ? parsed.times : null;
  } catch {
    return null;
  }
}

function encodeRetimedLyrics(times: LyricLineTimes | null): string | null {
  if (times === null) return null;
  const json: RetimedLyricsJson = { version: RETIMED_LYRICS_VERSION, times };
  return JSON.stringify(json);
}

export async function saveLyricsRetimed(
  db: Database,
  stemSetId: number,
  times: LyricLineTimes | null,
): Promise<void> {
  await db
    .update(stemSets)
    .set({ lyricsRetimed: encodeRetimedLyrics(times) })
    .where(eq(stemSets.id, stemSetId));
}

interface RetimeSource {
  readonly synced: string | null;
  readonly plain: string | null;
}

// A plain-only retiming indexes the plain lines, so those must match as well.
export async function retainedRetime(
  db: Database,
  stemSetId: number,
  next: RetimeSource | null,
): Promise<LyricLineTimes | null> {
  const [row] = await db
    .select({
      synced: stemSets.lyricsSynced,
      plain: stemSets.lyricsPlain,
      retimed: stemSets.lyricsRetimed,
    })
    .from(stemSets)
    .where(eq(stemSets.id, stemSetId));
  if (row === undefined) return null;
  const synced = next?.synced ?? null;
  const sameSource =
    row.synced === synced &&
    (synced !== null || row.plain === (next?.plain ?? null));
  return sameSource ? parseRetimedLyrics(row.retimed) : null;
}
