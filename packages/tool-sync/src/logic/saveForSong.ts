import {
  FACT_SEPARATOR,
  subdivisionName,
  timeSignatureLabel,
} from '@kitbag/core-design';
import { KB_ACCENT } from '@kitbag/core-native';
import {
  SAVE_REFUSAL,
  soundChipLabel,
  type PlayAlongPattern,
  type PlayAlongTrack,
  type SaveRefusal,
} from '@kitbag/core-state';

import { FIRST_BEAT, phaseReading } from './phaseView.ts';

export interface SaveRow {
  readonly label: string;
  readonly value: string;
}

export const TEMPO_NOT_SAVED =
  'Tempo isn’t saved. It comes from the beat grid or the lookup each time.';

export const SAVE_REFUSAL_TEXT: Readonly<Record<SaveRefusal, string>> = {
  [SAVE_REFUSAL.notLocked]: 'The lock dropped. Tap along again, then save.',
  [SAVE_REFUSAL.noTrackIdentity]:
    'This track has no title, so Kitbag can’t match it next time.',
  [SAVE_REFUSAL.writeFailed]: 'Couldn’t save. Try again.',
};

const NO_ACCENTS = 'None';
const LIST_JOIN = ', ';
const RECALL_LEAD = 'Your saved settings are back: ';

export function accentsValue(accents: readonly KB_ACCENT[]): string {
  const beats = accents.flatMap((accent, beat) =>
    accent === KB_ACCENT.KB_ACCENT_ACCENTED ? [String(beat + FIRST_BEAT)] : [],
  );
  if (beats.length === 0) return NO_ACCENTS;
  const noun = beats.length === 1 ? 'Beat' : 'Beats';
  return `${noun} ${beats.join(LIST_JOIN)}`;
}

export const trackLabel = ({ title, artist }: PlayAlongTrack): string =>
  [title, artist]
    .filter((part): part is string => part !== null && part !== '')
    .join(FACT_SEPARATOR);

const meterLabel = ({ beatsPerBar, denominator }: PlayAlongPattern) =>
  timeSignatureLabel({ beats: beatsPerBar, denominator });

const subdivisionLabel = ({ subdivision, denominator }: PlayAlongPattern) =>
  subdivisionName(subdivision, denominator);

export function saveRows(
  pattern: PlayAlongPattern,
  track: PlayAlongTrack,
  phaseOffsetMs: number,
): readonly SaveRow[] {
  return [
    { label: 'Track', value: trackLabel(track) },
    { label: 'Meter', value: meterLabel(pattern) },
    { label: 'Subdivision', value: subdivisionLabel(pattern) },
    { label: 'Accents', value: accentsValue(pattern.accents) },
    { label: 'Sound', value: soundChipLabel(pattern.sounds) },
    { label: 'Phase nudge', value: phaseReading(phaseOffsetMs) },
  ];
}

export function recallLine(
  pattern: PlayAlongPattern,
  savedPhaseMs?: number,
): string {
  const facts = [
    meterLabel(pattern),
    subdivisionLabel(pattern).toLowerCase(),
    soundChipLabel(pattern.sounds),
  ];
  if (savedPhaseMs !== undefined && savedPhaseMs !== 0)
    facts.push(phaseReading(savedPhaseMs));
  return `${RECALL_LEAD}${facts.join(LIST_JOIN)}`;
}
