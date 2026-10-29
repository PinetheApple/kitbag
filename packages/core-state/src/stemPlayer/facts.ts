import type { StemSetRecord } from '@kitbag/core-db';

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
  return mode === null ? tonic : `${tonic} ${mode}`;
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

const BPM_UNIT = 'BPM';

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
): SongFact | null {
  const parts = keyParts(key, scale);
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

export function songFacts(source: SongFactsSource): SongFacts {
  return {
    bpm: bpmFact(source.bpm),
    key: keyFact(source.key, source.scale, source.keyConfidence),
    tempo:
      source.tempoStability === null ? null : stability(source.tempoStability),
  };
}

export const NO_SONG_FACTS: SongFacts = { bpm: null, key: null, tempo: null };
