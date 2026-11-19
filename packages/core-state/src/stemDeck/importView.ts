import type {
  StemDeckConstants,
  StemDeckImportItem,
  StemDeckImportSnapshot,
} from '@kitbag/core-native';

import type { BundleRefusal } from '../songLibrary/stemBundleLogic.ts';
import { nativeFailure, type StemDeckFailure } from './failures.ts';

export type ImportPhase =
  | 'waiting'
  | 'preparing'
  | 'downloading'
  | 'adding'
  | 'added'
  | 'skipped'
  | 'failed'
  | 'notStarted';

export interface ImportRow {
  readonly jobId: string;
  readonly title: string;
  readonly phase: ImportPhase;
  readonly failure: StemDeckFailure | null;
  readonly refusal: BundleRefusal | null;
  readonly percent: number | null;
  readonly bytesDone: number;
  readonly bytesTotal: number | null;
  readonly bytesFree: number | null;
}

export interface ImportView {
  readonly origin: string | null;
  readonly rows: readonly ImportRow[];
  readonly added: number;
  readonly running: boolean;
  readonly finished: boolean;
  readonly stopped: StemDeckFailure | null;
  readonly retryCount: number;
}

export interface SkippedSong {
  readonly jobId: string;
  readonly title: string;
}

const PERCENT = 100;

function phaseOf(state: string, codes: StemDeckConstants): ImportPhase {
  const phases: [string, ImportPhase][] = [
    [codes.statePreparing, 'preparing'],
    [codes.stateDownloading, 'downloading'],
    [codes.stateAdding, 'adding'],
    [codes.stateAdded, 'added'],
    [codes.stateSkipped, 'skipped'],
    [codes.stateFailed, 'failed'],
    [codes.stateNotStarted, 'notStarted'],
  ];
  return phases.find(([code]) => code === state)?.[1] ?? 'waiting';
}

function known(bytes: number, codes: StemDeckConstants): number | null {
  return bytes === codes.unknownBytes ? null : bytes;
}

function row(
  item: StemDeckImportItem,
  codes: StemDeckConstants,
  refusals: ReadonlyMap<string, BundleRefusal>,
): ImportRow {
  const phase = phaseOf(item.state, codes);
  const total = known(item.bytesTotal, codes);
  const percent =
    phase === 'downloading' && total !== null && total > 0
      ? Math.min(PERCENT, Math.floor((item.bytesDone * PERCENT) / total))
      : null;
  return {
    jobId: item.jobId,
    title: item.title,
    phase,
    failure: item.failure === null ? null : nativeFailure(item.failure, codes),
    refusal: refusals.get(item.jobId) ?? null,
    percent,
    bytesDone: item.bytesDone,
    bytesTotal: total,
    bytesFree: known(item.bytesFree, codes),
  };
}

function skippedRow(song: SkippedSong): ImportRow {
  return {
    ...song,
    phase: 'skipped',
    failure: null,
    refusal: null,
    percent: null,
    bytesDone: 0,
    bytesTotal: null,
    bytesFree: null,
  };
}

const LEFT: ReadonlySet<ImportPhase> = new Set(['failed', 'notStarted']);

// Songs the user chose to keep never reach native, so they are listed here first.
export function importView(
  snapshot: StemDeckImportSnapshot,
  codes: StemDeckConstants,
  skipped: readonly SkippedSong[],
  refusals: ReadonlyMap<string, BundleRefusal>,
): ImportView {
  const rows = [
    ...skipped.map(skippedRow),
    ...snapshot.items.map((item) => row(item, codes, refusals)),
  ];
  const stopped =
    snapshot.stopReason === null
      ? null
      : nativeFailure(snapshot.stopReason, codes);
  return {
    origin: snapshot.origin,
    rows,
    added: rows.filter((r) => r.phase === 'added').length,
    running: snapshot.running,
    finished:
      !snapshot.running &&
      snapshot.items.length > 0 &&
      rows.every((r) => !LEFT.has(r.phase) && r.phase !== 'adding'),
    stopped,
    retryCount: rows.filter((r) => LEFT.has(r.phase)).length,
  };
}
