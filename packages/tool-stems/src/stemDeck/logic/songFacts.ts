import { FACT_SEPARATOR } from '@kitbag/core-design';
import {
  formatClockSeconds,
  type StemDeckServerTrust,
  type StemDeckSong,
} from '@kitbag/core-state';

export function plural(count: number, one: string, many: string): string {
  return `${String(count)} ${count === 1 ? one : many}`;
}

export function stemCount(count: number): string {
  return plural(count, 'stem', 'stems');
}

export function songFacts(song: StemDeckSong): string {
  return [
    song.artist,
    song.durationSec === null
      ? null
      : formatClockSeconds(Math.round(song.durationSec)),
    stemCount(song.lanes.length),
  ]
    .filter((fact): fact is string => fact !== null)
    .join(FACT_SEPARATOR);
}

export function unavailableText(count: number): string {
  return count === 1
    ? '1 more song on StemDeck isn’t listed because its stems are missing on the computer.'
    : `${String(count)} more songs on StemDeck aren’t listed because their stems are missing on the computer.`;
}

export function importLabel(count: number): string {
  return count === 0
    ? 'Import songs'
    : `Import ${plural(count, 'song', 'songs')}`;
}

export function selectedText(count: number): string {
  return `${String(count)} selected`;
}

export function listSubtitle(address: string, songs: number): string {
  return `${address}${FACT_SEPARATOR}${plural(songs, 'song', 'songs')}`;
}

export function setlistLabel(name: string, songs: number): string {
  return `${name}${FACT_SEPARATOR}${String(songs)}`;
}

function dayStart(ms: number): number {
  const day = new Date(ms);
  day.setHours(0, 0, 0, 0);
  return day.getTime();
}

const DAY_MS = 86_400_000;

export function lastUsedText(
  usedAt: number,
  now: number,
  locale?: string,
): string {
  const days = Math.round((dayStart(now) - dayStart(usedAt)) / DAY_MS);
  if (days <= 0) return 'today';
  if (days === 1) return 'yesterday';
  const sameYear =
    new Date(usedAt).getFullYear() === new Date(now).getFullYear();
  return new Date(usedAt).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

const TRUST_WORDS: Readonly<Record<StemDeckServerTrust, string>> = {
  pinned: 'Trusted',
  system: 'Trusted',
  plain: 'Not encrypted',
};

export function recentSubtitle(
  trust: StemDeckServerTrust,
  usedAt: number,
  now: number,
  locale?: string,
): string {
  return `${TRUST_WORDS[trust]}${FACT_SEPARATOR}last used ${lastUsedText(usedAt, now, locale)}`;
}
