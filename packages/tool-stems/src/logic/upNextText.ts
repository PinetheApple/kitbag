import {
  countLabel,
  FACT_SEPARATOR,
  placeLabel,
  QUEUE_TEXT,
  signatureLabel,
} from '@kitbag/core-design';
import {
  BPM_UNIT,
  isPresetEntry,
  stemFacts,
  UP_NEXT_SOURCE,
  upNextTitle,
  type OnStage,
  type PresetSetlistEntry,
  type LibrarySongs,
  type SetlistEntry,
  type StemSongs,
  type UpNext,
} from '@kitbag/core-state';

const METRONOME = 'metronome';

export interface UpNextContext {
  readonly queueLength: number;
  readonly stage: OnStage;
  readonly setlistName: string;
  readonly library: LibrarySongs;
}

export interface UpNextText {
  readonly title: string;
  readonly source: string;
  readonly metronome: boolean;
}

function queuedSource(queueLength: number): string {
  const rest = queueLength - 1;
  if (rest <= 0) return QUEUE_TEXT.nextInQueue;
  return [
    QUEUE_TEXT.nextInQueue,
    countLabel(rest, 'more after it', 'more after it'),
  ].join(FACT_SEPARATOR);
}

function setlistSource(entry: SetlistEntry, context: UpNextContext): string {
  const { entries } = context.stage;
  const place = placeLabel(entries.indexOf(entry) + 1, entries.length);
  const parts = [context.setlistName, place];
  return [...parts, ...(isPresetEntry(entry) ? [METRONOME] : [])].join(
    FACT_SEPARATOR,
  );
}

export function upNextText(next: UpNext, context: UpNextContext): UpNextText {
  const title = upNextTitle(next, context.library);
  if (next.source === UP_NEXT_SOURCE.queue)
    return {
      title,
      source: queuedSource(context.queueLength),
      metronome: false,
    };
  const { entry } = next;
  return {
    title,
    source: setlistSource(entry, context),
    metronome: isPresetEntry(entry),
  };
}

function metronomeFacts(preset: PresetSetlistEntry['preset']): string[] {
  return [
    QUEUE_TEXT.metronomeSong,
    `${String(Math.round(preset.bpm))} ${BPM_UNIT}`,
    signatureLabel(preset.beatsPerBar, preset.denominator),
  ];
}

export function setlistRowSubtitle(
  entry: SetlistEntry,
  setlistName: string,
  stems: StemSongs,
): string {
  const parts = isPresetEntry(entry)
    ? metronomeFacts(entry.preset)
    : [setlistName, stemFacts(entry.stemSetId, stems)];
  return parts.filter((part) => part !== '').join(FACT_SEPARATOR);
}

export function clearQueueBody(queueLength: number, setlistName: string) {
  const songs = countLabel(
    queueLength,
    'queued song leaves',
    'queued songs leave',
  );
  const leave = `The ${songs} the queue.`;
  return setlistName === ''
    ? leave
    : `${leave} ${setlistName} carries on after this song.`;
}
