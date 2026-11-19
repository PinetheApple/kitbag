import type { BadgeTone, IconName } from '@kitbag/core-design';
import type {
  StemDeckFailure,
  StemDeckImportPhase,
  StemDeckImportRow,
  StemDeckImportView,
} from '@kitbag/core-state';

import { CONNECTION_LOST, type Notice } from './failureText.ts';
import { plural, SEPARATOR, stemCount } from './songFacts.ts';

const BYTES_PER_MB = 1_000_000;
const PERCENT = 100;
const NOTHING_ADDED = 'nothing added';
const USER_STOP: StemDeckFailure = 'cancelled';

export type TileInk = 'green' | 'amber' | 'accent' | 'red' | 'text2';

export interface RowBadge {
  readonly label: string;
  readonly tone: BadgeTone;
  readonly icon?: IconName;
}

export interface RowTile {
  readonly icon: IconName;
  readonly ink: TileInk;
}

const TILES: Readonly<Record<StemDeckImportPhase, RowTile>> = {
  added: { icon: 'success', ink: 'green' },
  skipped: { icon: 'stems', ink: 'text2' },
  adding: { icon: 'analyzing', ink: 'amber' },
  downloading: { icon: 'saveInto', ink: 'accent' },
  preparing: { icon: 'countingIn', ink: 'accent' },
  waiting: { icon: 'song', ink: 'text2' },
  failed: { icon: 'error', ink: 'red' },
  notStarted: { icon: 'song', ink: 'text2' },
};

const BADGES: Readonly<Partial<Record<StemDeckImportPhase, RowBadge>>> = {
  added: { label: 'ADDED', tone: 'success', icon: 'check' },
  skipped: { label: 'SKIPPED', tone: 'default' },
  adding: { label: 'ADDING', tone: 'warning', icon: 'analyzing' },
  preparing: { label: 'PREPARING', tone: 'accent', icon: 'countingIn' },
  failed: { label: 'FAILED', tone: 'danger', icon: 'error' },
};

export function megabytes(bytes: number): string {
  return String(Math.round(bytes / BYTES_PER_MB));
}

export function rowTile(row: StemDeckImportRow): RowTile {
  return TILES[row.phase];
}

export function rowBadge(row: StemDeckImportRow): RowBadge | null {
  return BADGES[row.phase] ?? null;
}

export function percentText(percent: number): string {
  return `${String(percent)}%`;
}

function failedDetail(row: StemDeckImportRow): string {
  const total = row.bytesTotal;
  if (row.failure === 'noSpace' && total !== null)
    return `Needs ${megabytes(total)} MB${SEPARATOR}${NOTHING_ADDED}`;
  if (row.failure !== null && CONNECTION_LOST.has(row.failure)) {
    const at =
      total === null || total <= 0
        ? ''
        : ` at ${percentText(Math.floor((row.bytesDone * PERCENT) / total))}`;
    return `Connection lost${at}${SEPARATOR}${NOTHING_ADDED}`;
  }
  return `Not added${SEPARATOR}${NOTHING_ADDED}`;
}

export function rowDetail(
  row: StemDeckImportRow,
  stems: number | null,
): string {
  switch (row.phase) {
    case 'added':
      return stems === null
        ? 'In Stem songs'
        : `${stemCount(stems)}${SEPARATOR}in Stem songs`;
    case 'skipped':
      return `Already in your library${SEPARATOR}skipped`;
    case 'adding':
      return 'Adding to your library…';
    case 'downloading':
      return row.bytesTotal === null
        ? `Downloading${SEPARATOR}${megabytes(row.bytesDone)} MB`
        : `Downloading${SEPARATOR}${megabytes(row.bytesDone)} of ${megabytes(row.bytesTotal)} MB`;
    case 'preparing':
      return 'StemDeck is preparing this song. It can take a minute or two.';
    case 'waiting':
      return 'Waiting';
    case 'notStarted':
      return 'Not started';
    case 'failed':
      return failedDetail(row);
  }
}

export function addedText(view: StemDeckImportView): string {
  return `${String(view.added)} of ${String(view.rows.length)} added`;
}

export function retryLabel(count: number): string {
  return `Retry ${plural(count, 'song', 'songs')}`;
}

export function finishedText(added: number): string {
  return `${String(added)} ${added === 1 ? 'song is' : 'songs are'} in Stem songs.`;
}

function noSpaceNotice(view: StemDeckImportView): Notice {
  const row = view.rows.find((r) => r.failure === 'noSpace');
  const facts =
    row === undefined || row.bytesTotal === null || row.bytesFree === null
      ? ''
      : `${row.title} needs ${megabytes(row.bytesTotal)} MB and this phone has ${megabytes(row.bytesFree)} MB free. `;
  return {
    tone: 'danger',
    title: 'Not enough space',
    body: `${facts}Free some space, then retry.`,
  };
}

export function stopNotice(
  view: StemDeckImportView,
  failure: StemDeckFailure,
): Notice {
  if (CONNECTION_LOST.has(failure))
    return {
      tone: 'danger',
      title: 'Lost the connection to StemDeck',
      body: 'Check that StemDeck is still open on the computer and that this phone is on the same Wi-Fi.',
    };
  switch (failure) {
    case 'noSpace':
      return noSpaceNotice(view);
    case 'libraryUnavailable':
      return {
        tone: 'danger',
        title: 'Library storage unavailable',
        body: 'The library’s storage isn’t available. Reconnect it, then tap Retry.',
      };
    case 'timeLimit':
      return {
        tone: 'warning',
        title: 'Android’s import time ran out',
        body: 'Android limits how long imports can run each day. Retry later to finish the rest.',
      };
    case 'interrupted':
      return {
        tone: 'danger',
        title: 'The import was interrupted',
        body: 'Android stopped the import. Finished songs are in Stem songs; retry the rest.',
      };
    case 'cancelled':
      return {
        tone: 'warning',
        title: 'Import stopped',
        body: 'Finished songs are in Stem songs. The rest weren’t imported.',
      };
    default:
      return {
        tone: 'danger',
        title: 'The import stopped',
        body: 'Retry to try the rest again.',
      };
  }
}

export function importCardShows(
  view: StemDeckImportView | null,
): view is StemDeckImportView {
  if (view === null) return false;
  return view.running || (view.retryCount > 0 && view.stopped !== USER_STOP);
}

export function importClearable(view: StemDeckImportView): boolean {
  return view.retryCount > 0 && view.rows.every((r) => r.phase !== 'adding');
}

export function statusCardText(view: StemDeckImportView): string {
  if (view.running)
    return `Getting songs from StemDeck${SEPARATOR}${addedText(view)}`;
  const lead =
    view.stopped === null
      ? addedText(view)
      : stopNotice(view, view.stopped).title;
  const left = plural(view.retryCount, 'song', 'songs');
  return `${lead}${SEPARATOR}${left} left`;
}
