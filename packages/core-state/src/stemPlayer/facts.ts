import type { StemSetRecord } from '@kitbag/core-db';

import { UNSHIFTED_KEY } from './mix.ts';

export const STEADY_TEMPO_MIN = 80;
export const CONFIDENT_KEY_MIN = 50;

const MODE_NAMES: Readonly<Record<string, string>> = {
  maj: 'major',
  major: 'major',
  min: 'minor',
  minor: 'minor',
};
const MODE_SHORT: Readonly<Record<string, string>> = {
  major: 'maj',
  minor: 'min',
};

export type SongFactsSource = Pick<
  StemSetRecord,
  'bpm' | 'key' | 'scale' | 'keyConfidence' | 'tempoStability'
>;

export interface SongFact {
  readonly text: string;
  readonly spoken: string;
  readonly muted: boolean;
}

export interface BpmFact extends SongFact {
  readonly value: string;
  readonly unit: string;
}

export interface SongFacts {
  readonly bpm: BpmFact | null;
  readonly key: SongFact | null;
  readonly tempo: SongFact | null;
}

interface KeyParts {
  readonly tonic: string;
  readonly mode: string | null;
}

export interface PlaybackShift {
  readonly speed: number;
  readonly key: number;
}

const SEMITONES_PER_OCTAVE = 12;
const NATURAL_SEMITONES: Readonly<Record<string, number>> = {
  C: 0,
  D: 2,
  E: 4,
  F: 5,
  G: 7,
  A: 9,
  B: 11,
};
const ACCIDENTAL_SEMITONES: Readonly<Record<string, number>> = {
  '': 0,
  '#': 1,
  '♯': 1,
  b: -1,
  '♭': -1,
};
const MAJOR_SPELLING = [
  'C',
  'D♭',
  'D',
  'E♭',
  'E',
  'F',
  'F♯',
  'G',
  'A♭',
  'A',
  'B♭',
  'B',
] as const;
const MINOR_SPELLING = [
  'C',
  'C♯',
  'D',
  'E♭',
  'E',
  'F',
  'F♯',
  'G',
  'G♯',
  'A',
  'B♭',
  'B',
] as const;
const TONIC = /^([A-Ga-g])([#♯b♭]?)$/u;
const SPOKEN_ACCIDENTALS: readonly (readonly [RegExp, string])[] = [
  [/♭/gu, ' flat'],
  [/♯/gu, ' sharp'],
];

function pitchClass(tonic: string): number | null {
  const match = TONIC.exec(tonic);
  if (match === null) return null;
  const [, letter = '', accidental = ''] = match;
  const natural = NATURAL_SEMITONES[letter.toUpperCase()] ?? 0;
  return natural + (ACCIDENTAL_SEMITONES[accidental] ?? 0);
}

function transposed(parts: KeyParts, semitones: number): KeyParts | null {
  const from = pitchClass(parts.tonic);
  if (from === null) return null;
  const to =
    (((from + semitones) % SEMITONES_PER_OCTAVE) + SEMITONES_PER_OCTAVE) %
    SEMITONES_PER_OCTAVE;
  const spelling = parts.mode === 'minor' ? MINOR_SPELLING : MAJOR_SPELLING;
  return { ...parts, tonic: spelling[to] ?? parts.tonic };
}

function spokenTonic(tonic: string): string {
  return SPOKEN_ACCIDENTALS.reduce(
    (text, [glyph, word]) => text.replace(glyph, word),
    tonic,
  );
}

// StemDeck writes the mode into the key as well ("F maj" with scale "Major").
function keyParts(key: string | null, scale: string | null): KeyParts | null {
  const [tonic, ...rest] = (key ?? '').trim().split(/\s+/);
  if (tonic === undefined || tonic === '') return null;
  const raw = (scale ?? '').trim() || rest.join(' ');
  if (raw === '') return { tonic, mode: null };
  const lower = raw.toLowerCase();
  return { tonic, mode: MODE_NAMES[lower] ?? lower };
}

function longName({ tonic, mode }: KeyParts): string {
  const spoken = spokenTonic(tonic);
  return mode === null ? spoken : `${spoken} ${mode}`;
}

function shortName({ tonic, mode }: KeyParts): string {
  return mode === null ? tonic : `${tonic} ${MODE_SHORT[mode] ?? mode}`;
}

export function shortKeyName(key: string | null, scale: string | null) {
  const parts = keyParts(key, scale);
  return parts === null ? null : shortName(parts);
}

export function roundedBpm(bpm: number | null): string | null {
  return bpm === null || bpm <= 0 ? null : String(Math.round(bpm));
}

export const BPM_UNIT = 'BPM';

export function bpmFact(bpm: number | null): BpmFact | null {
  const rounded = roundedBpm(bpm);
  if (rounded === null) return null;
  return {
    value: rounded,
    unit: BPM_UNIT,
    text: `${rounded} ${BPM_UNIT}`,
    spoken: `${rounded} beats per minute`,
    muted: false,
  };
}

export function keyFact(
  key: string | null,
  scale: string | null,
  confidence: number | null,
  semitones: number = UNSHIFTED_KEY,
): SongFact | null {
  const recorded = keyParts(key, scale);
  const parts =
    recorded === null || semitones === UNSHIFTED_KEY
      ? recorded
      : transposed(recorded, semitones);
  if (parts === null) return null;
  const unsure = confidence !== null && confidence < CONFIDENT_KEY_MIN;
  const spoken = `key ${longName(parts)}`;
  return {
    text: shortName(parts),
    spoken: unsure ? `${spoken}, uncertain` : spoken,
    muted: unsure,
  };
}

function stability(tempoStability: number): SongFact {
  const word = tempoStability >= STEADY_TEMPO_MIN ? 'steady' : 'variable';
  const text = `${word} tempo`;
  return { text, spoken: text, muted: false };
}

export function songFacts(
  source: SongFactsSource,
  shift?: PlaybackShift,
): SongFacts {
  const { bpm } = source;
  return {
    bpm: bpmFact(bpm === null || shift === undefined ? bpm : bpm * shift.speed),
    key: keyFact(
      source.key,
      source.scale,
      source.keyConfidence,
      shift?.key ?? UNSHIFTED_KEY,
    ),
    tempo:
      source.tempoStability === null ? null : stability(source.tempoStability),
  };
}

export const NO_SONG_FACTS: SongFacts = { bpm: null, key: null, tempo: null };
