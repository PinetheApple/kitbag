import { sameQueuedSong, type QueuedSong } from '@kitbag/core-db';
import { createStore } from 'zustand/vanilla';

export interface HeardSong {
  readonly song: QueuedSong;
  readonly setlistItemId: number | null;
}

export interface HeardState {
  readonly heard: readonly HeardSong[];
}

export const heardStore = createStore<HeardState>(() => ({ heard: [] }));

export function droppedTrailing(
  heard: readonly HeardSong[],
  song: QueuedSong,
): readonly HeardSong[] {
  let end = heard.length;
  const isSong = (entry: HeardSong | undefined) =>
    entry !== undefined && sameQueuedSong(entry.song, song);
  while (isSong(heard[end - 1])) end--;
  return heard.slice(0, end);
}

export function heardAfter(
  heard: readonly HeardSong[],
  entry: HeardSong,
): readonly HeardSong[] {
  const last = heard.at(-1);
  const same =
    last !== undefined &&
    sameQueuedSong(last.song, entry.song) &&
    last.setlistItemId === entry.setlistItemId;
  return same ? heard : [...heard, entry];
}

export function withoutSong(
  heard: readonly HeardSong[],
  song: QueuedSong,
): readonly HeardSong[] {
  return heard.filter((entry) => !sameQueuedSong(entry.song, song));
}

export function hearSong(entry: HeardSong): void {
  heardStore.setState({
    heard: heardAfter(heardStore.getState().heard, entry),
  });
}

export function forgetSong(song: QueuedSong): void {
  heardStore.setState({
    heard: withoutSong(heardStore.getState().heard, song),
  });
}

export function forgetHeard(): void {
  heardStore.setState({ heard: [] });
}
