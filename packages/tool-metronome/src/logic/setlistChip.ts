import { countLabel } from '@kitbag/core-design';
import {
  SONG_STEP,
  type ActiveSet,
  type LoadedSong,
  type SetlistEntry,
  type SongPreset,
  type SongStep,
} from '@kitbag/core-state';

export interface SongChipText {
  readonly title: string;
  readonly context: string;
}

export const NO_ACTIVE_SET = 'Setlists';
export const NOT_IN_SETLIST = 'Not in a setlist';
export const UNSAVED_CHANGES = 'Unsaved changes';
const UNSAVED = UNSAVED_CHANGES.toLowerCase();

const STEP_NAME: Readonly<Record<SongStep, string>> = {
  [SONG_STEP.previous]: 'Previous song',
  [SONG_STEP.next]: 'Next song',
};

function songs(count: number): string {
  return countLabel(count, 'song', 'songs');
}

export function setlistChipLabel(set: ActiveSet | undefined): string {
  if (set === undefined) return NO_ACTIVE_SET;
  if (set.position === undefined) return `${set.name} · ${songs(set.count)}`;
  return `${set.name} · ${String(set.position)}/${String(set.count)}`;
}

export function transportSubtitle(
  set: ActiveSet,
  song: string | undefined,
): string {
  if (set.position === undefined || song === undefined)
    return setlistChipLabel(set);
  return `${set.name} · ${song} (${String(set.position)}/${String(set.count)})`;
}

export function setlistChipA11yLabel(set: ActiveSet | undefined): string {
  if (set === undefined) return 'Setlists, none active';
  if (set.position === undefined)
    return `Setlist ${set.name}, ${songs(set.count)}`;
  return `Setlist ${set.name}, song ${String(set.position)} of ${String(set.count)}`;
}

export function stageChipText(
  song: string | undefined,
  set: ActiveSet,
): SongChipText {
  if (set.position === undefined || song === undefined)
    return { title: set.name, context: songs(set.count) };
  return { title: song, context: setlistChipLabel(set) };
}

function spokenSong(song: string, unsaved: boolean): string {
  return unsaved ? `${song}, ${UNSAVED}` : song;
}

export function stageChipA11yLabel(
  song: string | undefined,
  set: ActiveSet,
  unsaved: boolean,
): string {
  const context = setlistChipA11yLabel(set);
  if (set.position === undefined || song === undefined) return context;
  return `${spokenSong(song, unsaved)}, ${context}`;
}

export function soloChipText(
  song: string | undefined,
): SongChipText | undefined {
  return song === undefined
    ? undefined
    : { title: song, context: NOT_IN_SETLIST };
}

export function soloChipA11yLabel(song: string, unsaved: boolean): string {
  return `${spokenSong(song, unsaved)}, ${NOT_IN_SETLIST.toLowerCase()}`;
}

export function nowRowA11yLabel(spoken: string, unsaved: boolean): string {
  return unsaved
    ? `${spoken}, now loaded, ${UNSAVED}`
    : `${spoken}, now loaded`;
}

export function notSavedMessage(song: string): string {
  return `Changes to ${song} not saved`;
}

export function stepA11yLabel(
  step: SongStep,
  target: SetlistEntry | undefined,
): string {
  const name = STEP_NAME[step];
  return target === undefined ? name : `${name}, ${target.preset.name}`;
}

export type NamedSong = Pick<SongPreset, 'id' | 'name'>;

export function loadedSongName(
  presets: readonly NamedSong[],
  loaded: LoadedSong | null,
): string | undefined {
  if (loaded === null) return undefined;
  return presets.find((preset) => preset.id === loaded.presetId)?.name;
}
