import { sameQueuedSong, type QueuedSong } from '@kitbag/core-db';
import { createStore } from 'zustand/vanilla';

import type { LoadedSong } from '../library/store.ts';

export const REPEAT = { off: 'off', all: 'all', one: 'one' } as const;

export type RepeatMode = (typeof REPEAT)[keyof typeof REPEAT];

const CYCLE: Readonly<Record<RepeatMode, RepeatMode>> = {
  off: REPEAT.all,
  all: REPEAT.one,
  one: REPEAT.off,
};

export interface SetlistRestart {
  readonly setlistId: number;
  readonly from: LoadedSong | null;
}

export interface RepeatState {
  readonly mode: RepeatMode;
  readonly played: readonly QueuedSong[];
  readonly restart: SetlistRestart | null;
  readonly allHintSeen: boolean;
}

const NEW_ROUND = { played: [], restart: null } as const;

export const repeatStore = createStore<RepeatState>(() => ({
  mode: REPEAT.off,
  ...NEW_ROUND,
  allHintSeen: false,
}));

export function cycleRepeat(): void {
  const { mode } = repeatStore.getState();
  repeatStore.setState({ mode: CYCLE[mode], ...NEW_ROUND });
}

export function repeatsAll(): boolean {
  return repeatStore.getState().mode === REPEAT.all;
}

export function notePlayedQueued(song: QueuedSong): void {
  const { mode, played } = repeatStore.getState();
  if (mode !== REPEAT.all) return;
  const others = played.filter((each) => !sameQueuedSong(each, song));
  repeatStore.setState({ played: [...others, song] });
}

export function endRepeatRound(): void {
  repeatStore.setState(NEW_ROUND);
}

export function restartedAt(
  { restart }: Pick<RepeatState, 'restart'>,
  setlistId: number | null,
  loaded: LoadedSong | null,
): boolean {
  return (
    restart !== null &&
    restart.setlistId === setlistId &&
    restart.from === loaded
  );
}

export function seeAllHint(): void {
  repeatStore.setState({ allHintSeen: true });
}
