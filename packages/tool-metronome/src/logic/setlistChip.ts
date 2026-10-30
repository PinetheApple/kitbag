import { countLabel } from '@kitbag/core-design';
import {
  activeSetlistOf,
  SONG_STEP,
  type LoadedSong,
  type SetlistEntry,
  type SetlistSummary,
  type SongStep,
} from '@kitbag/core-state';

export interface ActiveSet {
  readonly id: number;
  readonly name: string;
  readonly count: number;
  readonly position: number | undefined;
}

export interface SongChipText {
  readonly title: string;
  readonly context: string;
}

export const NO_ACTIVE_SET = 'Setlists';
export const NOT_IN_SETLIST = 'Not in a setlist';

const STEP_NAME: Readonly<Record<SongStep, string>> = {
  [SONG_STEP.previous]: 'Previous song',
  [SONG_STEP.next]: 'Next song',
};

function songs(count: number): string {
  return countLabel(count, 'song', 'songs');
}

export function activeSetView(
  setlists: readonly SetlistSummary[],
  entries: Readonly<Record<number, readonly SetlistEntry[]>>,
  loaded: LoadedSong | null,
): ActiveSet | undefined {
  const active = activeSetlistOf(setlists);
  if (active === undefined) return undefined;
  const id = active.setlist.id;
  if (loaded !== null && loaded.setlistId !== id) return undefined;
  const index = (entries[id] ?? []).findIndex(
    (entry) => entry.item.id === loaded?.itemId,
  );
  return {
    id,
    name: active.setlist.name,
    count: active.songCount,
    position: index < 0 ? undefined : index + 1,
  };
}

export function setlistChipLabel(set: ActiveSet | undefined): string {
  if (set === undefined) return NO_ACTIVE_SET;
  if (set.position === undefined) return `${set.name} · ${songs(set.count)}`;
  return `${set.name} · ${String(set.position)}/${String(set.count)}`;
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

export function stageChipA11yLabel(
  song: string | undefined,
  set: ActiveSet,
): string {
  const context = setlistChipA11yLabel(set);
  if (set.position === undefined || song === undefined) return context;
  return `${song}, ${context}`;
}

export function soloChipText(
  song: string | undefined,
): SongChipText | undefined {
  return song === undefined
    ? undefined
    : { title: song, context: NOT_IN_SETLIST };
}

export function soloChipA11yLabel(song: string): string {
  return `${song}, ${NOT_IN_SETLIST.toLowerCase()}`;
}

export function stepA11yLabel(
  step: SongStep,
  target: SetlistEntry | undefined,
): string {
  const name = STEP_NAME[step];
  return target === undefined ? name : `${name}, ${target.preset.name}`;
}
