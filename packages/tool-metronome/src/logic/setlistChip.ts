import { countLabel } from '@kitbag/core-design';
import {
  activeSetlistOf,
  SONG_STEP,
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

export interface SongListRow {
  readonly itemId: number;
  readonly presetId: number;
  readonly number: string;
  readonly name: string;
  readonly bpm: string;
  readonly now: boolean;
}

export const NO_ACTIVE_SET = 'Setlists';
export const NOT_IN_SETLIST = 'Not in a setlist';

const STEP_NAME: Readonly<Record<SongStep, string>> = {
  [SONG_STEP.previous]: 'Previous song',
  [SONG_STEP.next]: 'Next song',
};

export function activeSetOf(
  setlists: readonly SetlistSummary[],
  entries: Readonly<Record<number, readonly SetlistEntry[]>>,
  loadedItemId: number | null,
): ActiveSet | undefined {
  const active = activeSetlistOf(setlists);
  if (active === undefined) return undefined;
  const index = (entries[active.setlist.id] ?? []).findIndex(
    (entry) => entry.item.id === loadedItemId,
  );
  return {
    id: active.setlist.id,
    name: active.setlist.name,
    count: active.songCount,
    position: index < 0 ? undefined : index + 1,
  };
}

export function setlistChipLabel(set: ActiveSet | undefined): string {
  if (set === undefined) return NO_ACTIVE_SET;
  if (set.position === undefined) {
    return `${set.name} · ${countLabel(set.count, 'song', 'songs')}`;
  }
  return `${set.name} · ${String(set.position)}/${String(set.count)}`;
}

export function setlistChipA11yLabel(set: ActiveSet | undefined): string {
  if (set === undefined) return 'Setlists, none active';
  if (set.position === undefined) {
    return `Setlist ${set.name}, ${countLabel(set.count, 'song', 'songs')}`;
  }
  return `Setlist ${set.name}, song ${String(set.position)} of ${String(set.count)}`;
}

export function stageChipText(
  song: string | undefined,
  set: ActiveSet,
): SongChipText {
  return { title: song ?? set.name, context: setlistChipLabel(set) };
}

export function soloChipText(
  song: string | undefined,
): SongChipText | undefined {
  return song === undefined
    ? undefined
    : { title: song, context: NOT_IN_SETLIST };
}

export function songChipA11yLabel(
  song: string | undefined,
  set: ActiveSet | undefined,
): string {
  const context =
    set === undefined ? NOT_IN_SETLIST : setlistChipA11yLabel(set);
  return song === undefined ? context : `${song}, ${context}`;
}

export function stepA11yLabel(
  step: SongStep,
  target: SetlistEntry | undefined,
): string {
  const name = STEP_NAME[step];
  return target === undefined ? name : `${name}, ${target.preset.name}`;
}

export function songListHint(set: ActiveSet): string {
  const where =
    set.position === undefined
      ? countLabel(set.count, 'song', 'songs')
      : `song ${String(set.position)} of ${String(set.count)}`;
  return `On stage · ${where} · tap a song to load it`;
}

export function songListRows(
  entries: readonly SetlistEntry[],
  loadedItemId: number | null,
): SongListRow[] {
  return entries.map(({ item, preset }, index) => ({
    itemId: item.id,
    presetId: preset.id,
    number: String(index + 1),
    name: preset.name,
    bpm: String(Math.round(preset.bpm)),
    now: item.id === loadedItemId,
  }));
}
