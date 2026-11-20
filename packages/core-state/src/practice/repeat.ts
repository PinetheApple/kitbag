import {
  isStemSong,
  type LoggedCountIn,
  type LoggedSettings,
  type LoggedStretch,
  type PracticeLog,
  type PracticeSessionListing,
} from '@kitbag/core-db';

import {
  isPresetEntry,
  type LibrarySnapshot,
  type SetlistSummary,
} from '../library/snapshot.ts';

export interface RepeatSetup {
  readonly settings: LoggedSettings;
  readonly countIn: LoggedCountIn;
}

export const SESSION_LOAD = { setlist: 'setlist', song: 'song' } as const;

export interface SetlistLoad {
  readonly kind: typeof SESSION_LOAD.setlist;
  readonly setlistId: number;
  readonly name: string;
  readonly presetId: number;
  readonly itemId: number;
}

export interface SongLoad {
  readonly kind: typeof SESSION_LOAD.song;
  readonly presetId: number;
  readonly name: string;
}

export type SessionLoad = SetlistLoad | SongLoad;

export const REPEAT_PLAN = {
  setlist: 'setlist',
  freePlay: 'freePlay',
} as const;

export interface SetlistRepeat {
  readonly kind: typeof REPEAT_PLAN.setlist;
  readonly load: SetlistLoad;
  readonly songs: ReadonlyMap<string, RepeatSetup>;
}

export interface FreePlayRepeat {
  readonly kind: typeof REPEAT_PLAN.freePlay;
  readonly setup: RepeatSetup;
}

export type RepeatPlan = SetlistRepeat | FreePlayRepeat;

type LibraryView = Pick<LibrarySnapshot, 'setlists' | 'entries' | 'presets'>;

function setupOf(stretch: LoggedStretch): RepeatSetup | null {
  const { settings, countIn } = stretch;
  return settings === null || countIn === null ? null : { settings, countIn };
}

function firstSetups(log: PracticeLog): ReadonlyMap<string, RepeatSetup> {
  const songs = new Map<string, RepeatSetup>();
  for (const stretch of log.stretches) {
    const { song } = stretch;
    const setup = setupOf(stretch);
    if (song === null || isStemSong(song) || setup === null) continue;
    if (!songs.has(song.uuid)) songs.set(song.uuid, setup);
  }
  return songs;
}

function setlistLoadOf(
  library: LibraryView,
  summary: SetlistSummary | undefined,
): SetlistLoad | null {
  if (summary === undefined) return null;
  const { id, name } = summary.setlist;
  const first = (library.entries[id] ?? []).find(isPresetEntry);
  if (first === undefined) return null;
  return {
    kind: SESSION_LOAD.setlist,
    setlistId: id,
    name,
    presetId: first.preset.id,
    itemId: first.item.id,
  };
}

export function repeatPlanOf(
  log: PracticeLog,
  library: LibraryView,
): RepeatPlan | null {
  const played = log.stretches.find((stretch) => stretch.setlist !== null);
  const summary = library.setlists.find(
    (s) => s.setlist.uuid === played?.setlist?.uuid,
  );
  const load = setlistLoadOf(library, summary);
  if (load !== null)
    return { kind: REPEAT_PLAN.setlist, load, songs: firstSetups(log) };
  const setup = log.stretches.map(setupOf).find((found) => found !== null);
  return setup === undefined ? null : { kind: REPEAT_PLAN.freePlay, setup };
}

export function sessionLoadOf(
  session: PracticeSessionListing,
  library: LibraryView,
): SessionLoad | null {
  const summary = library.setlists.find(
    (s) => s.setlist.id === session.setlistId,
  );
  const setlist = setlistLoadOf(library, summary);
  if (setlist !== null) return setlist;
  const [only, ...more] = session.songUuids;
  const preset = library.presets.find((p) => p.uuid === only);
  if (preset === undefined || more.length > 0) return null;
  return { kind: SESSION_LOAD.song, presetId: preset.id, name: preset.name };
}
