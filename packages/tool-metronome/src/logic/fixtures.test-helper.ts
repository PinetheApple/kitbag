import { KB_ACCENT } from '@kitbag/core-native';
import type {
  SetlistEntry,
  SetlistSummary,
  SongPreset,
} from '@kitbag/core-state';

const {
  KB_ACCENT_ACCENTED: A,
  KB_ACCENT_NORMAL: N,
  KB_ACCENT_MUTED: M,
} = KB_ACCENT;

export const summary = (
  id: number,
  name: string,
  active: boolean,
  songCount: number,
) =>
  ({
    setlist: { id, name, active },
    songCount,
    rampCount: 0,
  }) as unknown as SetlistSummary;

export const entry = (
  itemId: number,
  name = '',
  bpm = 120,
  presetId = itemId,
) =>
  ({
    item: { id: itemId },
    preset: { id: presetId, name, bpm },
  }) as unknown as SetlistEntry;

export const songPreset = (overrides: Partial<SongPreset> = {}) =>
  ({
    id: 1,
    uuid: 'u',
    name: 'Blackbird',
    bpm: 96,
    beatsPerBar: 3,
    denominator: 4,
    subdivision: 2,
    accents: Uint8Array.from([A, N, N]),
    perAccentSounds: null,
    polyAccents: Uint8Array.from([A, N, M]),
    polyEnabled: false,
    polyBeats: 0,
    polyAgainst: 2,
    sound: 1,
    rampEnabled: true,
    rampStartBpm: 96,
    rampEndBpm: 104,
    rampLength: 90,
    rampUnit: 1,
    rampLoop: true,
    barMuteEnabled: false,
    barMutePlayBars: null,
    barMuteMuteBars: null,
    countInBars: 1,
    notes: 'Fingerstyle — count 3',
    phaseNudge: 0,
    title: null,
    artist: null,
    source: null,
    lengthSeconds: null,
    librarySongId: null,
    ...overrides,
  }) as unknown as SongPreset;
