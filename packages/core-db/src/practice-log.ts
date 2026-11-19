import { presetBase64, presetBytes } from './base64';
import { isBoolean, isNumber, isRecord, isString, type Check } from './guards';
import type { SongPreset } from './repository';

export const PRACTICE_LOG_VERSION = 1;

export const STRETCH_END = {
  pause: 'pause',
  song: 'song',
  settings: 'settings',
  end: 'end',
} as const;

export type StretchEnd = (typeof STRETCH_END)[keyof typeof STRETCH_END];

const STRETCH_ENDS: readonly unknown[] = Object.values(STRETCH_END);

type LoggedField =
  | 'bpm'
  | 'beatsPerBar'
  | 'denominator'
  | 'subdivision'
  | 'polyEnabled'
  | 'polyBeats'
  | 'polyAgainst'
  | 'sound'
  | 'rampEnabled'
  | 'rampStartBpm'
  | 'rampEndBpm'
  | 'rampStep'
  | 'rampLength'
  | 'rampUnit'
  | 'rampLoop'
  | 'barMuteEnabled'
  | 'barMutePlayBars'
  | 'barMuteMuteBars'
  | 'countInBars';

export type StretchSettingsFields = Pick<SongPreset, LoggedField> &
  Parameters<typeof presetBase64>[0];

export type LoggedSettings = Pick<SongPreset, LoggedField> &
  ReturnType<typeof presetBase64>;

export interface LoggedCountIn {
  readonly bars: number;
  readonly distinct: boolean;
  readonly sound: number;
}

export interface LoggedPresetSong {
  readonly uuid: string;
  readonly title: string;
}

export interface LoggedStemSong {
  readonly stemSongKey: string;
  readonly title: string;
}

export type LoggedSong = LoggedPresetSong | LoggedStemSong;

export interface LoggedSetlist {
  readonly uuid: string;
  readonly name: string;
  readonly position: number | null;
}

export type TempoChange = readonly [offsetMs: number, bpm: number];

export interface LoggedStretch {
  readonly from: number;
  readonly to: number;
  readonly end: StretchEnd;
  readonly song: LoggedSong | null;
  readonly setlist: LoggedSetlist | null;
  readonly settings: LoggedSettings | null;
  readonly countIn: LoggedCountIn | null;
  readonly tempo: readonly TempoChange[];
  readonly endBpm: number;
  readonly avgBpm: number;
}

export interface PracticeLog {
  readonly v: typeof PRACTICE_LOG_VERSION;
  readonly stretches: readonly LoggedStretch[];
}

export function loggedSettingsOf(
  fields: StretchSettingsFields,
): LoggedSettings {
  return { ...fields, ...presetBase64(fields) };
}

export function presetFieldsOfLogged(
  settings: LoggedSettings,
): StretchSettingsFields {
  return { ...settings, ...presetBytes(settings) };
}

export function isStemSong(song: LoggedSong): song is LoggedStemSong {
  return 'stemSongKey' in song;
}

const orNull =
  <T>(check: Check<T>): Check<T | null> =>
  (value): value is T | null =>
    value === null || check(value);

const shaped =
  <T>(shape: { readonly [K in keyof T]-?: Check<T[K]> }): Check<T> =>
  (value): value is T =>
    isRecord(value) &&
    Object.entries<Check<unknown>>(shape).every(([key, check]) =>
      check(value[key]),
    );

const isSettings = shaped<LoggedSettings>({
  bpm: isNumber,
  beatsPerBar: isNumber,
  denominator: isNumber,
  subdivision: isNumber,
  accents: isString,
  perAccentSounds: orNull(isString),
  polyAccents: orNull(isString),
  polyEnabled: isBoolean,
  polyBeats: isNumber,
  polyAgainst: isNumber,
  sound: isNumber,
  rampEnabled: isBoolean,
  rampStartBpm: orNull(isNumber),
  rampEndBpm: orNull(isNumber),
  rampStep: isNumber,
  rampLength: orNull(isNumber),
  rampUnit: isNumber,
  rampLoop: isBoolean,
  barMuteEnabled: isBoolean,
  barMutePlayBars: orNull(isNumber),
  barMuteMuteBars: orNull(isNumber),
  countInBars: isNumber,
});

const isPresetSong = shaped<LoggedPresetSong>({
  uuid: isString,
  title: isString,
});
const isStemSongRecord = shaped<LoggedStemSong>({
  stemSongKey: isString,
  title: isString,
});
const isSong: Check<LoggedSong> = (value): value is LoggedSong =>
  isPresetSong(value) || isStemSongRecord(value);

const isStretchEnd: Check<StretchEnd> = (value): value is StretchEnd =>
  STRETCH_ENDS.includes(value);

const isTempoChange: Check<TempoChange> = (value): value is TempoChange =>
  Array.isArray(value) && value.length === 2 && value.every(isNumber);

const isTempo: Check<readonly TempoChange[]> = (
  value,
): value is readonly TempoChange[] =>
  Array.isArray(value) && value.every(isTempoChange);

const isStretch = shaped<LoggedStretch>({
  from: isNumber,
  to: isNumber,
  end: isStretchEnd,
  song: orNull(isSong),
  setlist: orNull(
    shaped<LoggedSetlist>({
      uuid: isString,
      name: isString,
      position: orNull(isNumber),
    }),
  ),
  settings: orNull(isSettings),
  countIn: orNull(
    shaped<LoggedCountIn>({
      bars: isNumber,
      distinct: isBoolean,
      sound: isNumber,
    }),
  ),
  tempo: isTempo,
  endBpm: isNumber,
  avgBpm: isNumber,
});

function isPracticeLog(value: unknown): value is PracticeLog {
  return (
    isRecord(value) &&
    value.v === PRACTICE_LOG_VERSION &&
    Array.isArray(value.stretches) &&
    value.stretches.every(
      (stretch) => isStretch(stretch) && stretch.from <= stretch.to,
    )
  );
}

export function encodePracticeLog(log: PracticeLog | null): string | null {
  return log === null ? null : JSON.stringify(log);
}

export function parsePracticeLog(text: string | null): PracticeLog | null {
  if (text === null) return null;
  try {
    const value: unknown = JSON.parse(text);
    return isPracticeLog(value) ? value : null;
  } catch {
    return null;
  }
}
