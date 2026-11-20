import { countLabel } from '@kitbag/core-design';
import {
  BPM_UNIT,
  entryName,
  isPresetEntry,
  stemFacts,
  stemSongTitle,
  UP_NEXT_SOURCE,
  type OnStage,
  type SetlistEntry,
  type SetlistSummary,
  type StemSongs,
  type UpNext,
} from '@kitbag/core-state';

import { SEPARATOR } from '../stemDeck/logic/songFacts.ts';
import { placeLabel } from './playOrderText.ts';

export const QUEUED = 'Queued';
const METRONOME = 'metronome';

export interface UpNextContext {
  readonly queueLength: number;
  readonly stage: OnStage;
  readonly setlistName: string;
  readonly stems: StemSongs;
}

export interface UpNextText {
  readonly title: string;
  readonly source: string;
  readonly metronome: boolean;
}

function queuedSource(queueLength: number): string {
  const rest = queueLength - 1;
  if (rest <= 0) return QUEUED;
  return [QUEUED, countLabel(rest, 'more after it', 'more after it')].join(
    SEPARATOR,
  );
}

function setlistSource(entry: SetlistEntry, context: UpNextContext): string {
  const { entries } = context.stage;
  const place = placeLabel(entries.indexOf(entry) + 1, entries.length);
  const parts = [context.setlistName, place];
  return [...parts, ...(isPresetEntry(entry) ? [METRONOME] : [])].join(
    SEPARATOR,
  );
}

export function upNextText(next: UpNext, context: UpNextContext): UpNextText {
  if (next.source === UP_NEXT_SOURCE.queue)
    return {
      title: stemSongTitle(next.stemSetId, context.stems),
      source: queuedSource(context.queueLength),
      metronome: false,
    };
  const { entry } = next;
  return {
    title: entryName(entry, context.stems),
    source: setlistSource(entry, context),
    metronome: isPresetEntry(entry),
  };
}

export function setlistRowSubtitle(
  entry: SetlistEntry,
  setlistName: string,
  stems: StemSongs,
): string {
  const facts = isPresetEntry(entry)
    ? [METRONOME, `${String(Math.round(entry.preset.bpm))} ${BPM_UNIT}`]
    : [stemFacts(entry.stemSetId, stems)];
  return [setlistName, ...facts].filter((part) => part !== '').join(SEPARATOR);
}

export function pickerSubtitle(
  summary: SetlistSummary,
  entries: readonly SetlistEntry[],
): string {
  const stemCount = entries.filter((entry) => !isPresetEntry(entry)).length;
  const parts = [countLabel(summary.songCount, 'song', 'songs')];
  if (stemCount > 0)
    parts.push(countLabel(stemCount, 'stem song', 'stem songs'));
  if (summary.setlist.active) parts.push('on stage');
  return parts.join(SEPARATOR);
}

export function clearQueueBody(queueLength: number, setlistName: string) {
  const songs = countLabel(
    queueLength,
    'queued song leaves',
    'queued songs leave',
  );
  const leave = `The ${songs} Up next.`;
  return setlistName === ''
    ? leave
    : `${leave} ${setlistName} carries on after this song.`;
}
