export const TEMPO_MODE = {
  constant: 'constant',
  follow: 'follow',
} as const;
export type TempoMode = (typeof TEMPO_MODE)[keyof typeof TEMPO_MODE];
export const TEMPO_MODES = Object.values(TEMPO_MODE) as [
  TempoMode,
  ...TempoMode[],
];

export const TEMPO_SOURCE = {
  detected: 'detected',
  user: 'user',
  analysed: 'analysed',
} as const;
export type TempoSource = (typeof TEMPO_SOURCE)[keyof typeof TEMPO_SOURCE];
export const TEMPO_SOURCES = Object.values(TEMPO_SOURCE) as [
  TempoSource,
  ...TempoSource[],
];

// StemDeck's limits for edited and fitted tempos.
export const TEMPO_MIN_BPM = 30;
export const TEMPO_MAX_BPM = 300;
export const TEMPO_MIN_ANCHOR_SECONDS = 0;
export const TEMPO_MIN_BEATS_PER_BAR = 1;
export const TEMPO_MAX_BEATS_PER_BAR = 32;
