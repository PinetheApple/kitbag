import type { QueuedSong } from '@kitbag/core-db';
import { createStore, type StoreApi } from 'zustand/vanilla';

import { libraryStore } from '../library/store.ts';
import type { PresetSetlistEntry } from '../library/snapshot.ts';
import {
  ADVANCE_CAUSE,
  ADVANCE_OUTCOME,
  type AdvanceCause,
  type AdvanceListener,
  type AdvanceOutcome,
} from '../stemPlayer/songEnd.ts';
import { stemPlayerStore } from '../stemPlayer/store.ts';
import { songPlayerStore } from '../songPlayer/store.ts';
import {
  ADVANCE,
  cursorOf,
  isPlayAdvance,
  onStageOf,
  songOfPlay,
  type Advance,
  type PlayAdvance,
  type PlayerKind,
} from './order.ts';
import { playingKind } from './nowPlaying.ts';
import { SKIP, type SkippedSong } from './queuedSongText.ts';
import { playOrderStore, type SkipResult, type Undo } from './store.ts';

export interface SetlistPlace {
  readonly number: number;
  readonly of: number;
}

export const ARRIVAL = {
  arriving: 'arriving',
  playing: 'playing',
  gaveUp: 'gaveUp',
  metronome: 'metronome',
} as const;

export type ArrivalEvent =
  | { readonly kind: typeof ARRIVAL.arriving; readonly song: QueuedSong }
  | {
      readonly kind: typeof ARRIVAL.playing;
      readonly song: QueuedSong;
      readonly place: SetlistPlace | null;
      readonly skipped: SkippedSong | null;
      readonly inApp: boolean;
    }
  | { readonly kind: typeof ARRIVAL.gaveUp; readonly skipped: SkippedSong }
  | { readonly kind: typeof ARRIVAL.metronome };

export type Arrival = ArrivalEvent & { readonly serial: number };

export interface ArrivalState {
  readonly arrival: Arrival | null;
}

export const arrivalStore = createStore<ArrivalState>(() => ({
  arrival: null,
}));

export interface AdvancingPlayer {
  readonly onSongEnd: (listener: AdvanceListener) => () => void;
  readonly advanceTo?: (id: number) => Promise<AdvanceOutcome>;
  readonly playNow?: (id: number) => Promise<AdvanceOutcome>;
  readonly takeOver: (id: number) => Promise<AdvanceOutcome>;
  readonly handOver: () => void;
  readonly stillEnded: () => boolean;
  readonly stopAdvancing: () => void;
  readonly handToMetronome: () => void;
}

export type AdvancingPlayers = Readonly<Record<PlayerKind, AdvancingPlayer>>;

export interface AutoAdvanceDeps {
  readonly players: AdvancingPlayers;
  readonly peekNext: () => Promise<SkipResult>;
  readonly commitNext: (
    next: Advance,
    stands: () => boolean,
  ) => Promise<Undo | null>;
  readonly placeOf: (advance: Advance) => SetlistPlace | null;
  readonly candidates: () => number;
  readonly commitOpen: (
    entry: PresetSetlistEntry,
    stands: () => boolean,
  ) => Promise<boolean>;
  readonly arrivals: StoreApi<ArrivalState>;
}

function onStageNow() {
  const library = libraryStore.getState();
  const stage = onStageOf(library);
  return { stage, cursor: cursorOf(stage, library.loaded) };
}

export type WaveformBars = Readonly<Record<PlayerKind, number>>;

const stemSongs = (bars: number): AdvancingPlayer => ({
  onSongEnd: (listener) => stemPlayerStore.getState().onSongEnd(listener),
  advanceTo: (id) => stemPlayerStore.getState().advanceTo(id),
  playNow: (id) => stemPlayerStore.getState().playNow(id),
  takeOver: (id) => stemPlayerStore.getState().takeOver(id, bars),
  handOver: () => {
    stemPlayerStore.getState().handOver();
  },
  stillEnded: () => stemPlayerStore.getState().songStillEnded(),
  stopAdvancing: () => {
    stemPlayerStore.getState().stopAdvancing();
  },
  handToMetronome: () => {
    stemPlayerStore.getState().handToMetronome();
  },
});

const singleSongs = (bars: number): AdvancingPlayer => ({
  onSongEnd: (listener) => songPlayerStore.getState().onSongEnd(listener),
  takeOver: (id) => songPlayerStore.getState().takeOver(id, bars),
  handOver: () => {
    songPlayerStore.getState().handOver();
  },
  stillEnded: () => songPlayerStore.getState().songStillEnded(),
  stopAdvancing: () => {
    songPlayerStore.getState().stopAdvancing();
  },
  handToMetronome: () => {
    songPlayerStore.getState().handToMetronome();
  },
});

const advancingPlayers = (bars: WaveformBars): AdvancingPlayers => ({
  stems: stemSongs(bars.stems),
  song: singleSongs(bars.song),
});

export const autoAdvanceDeps = (bars: WaveformBars): AutoAdvanceDeps => ({
  players: advancingPlayers(bars),
  peekNext: () => playOrderStore.getState().peekNext(),
  commitNext: (next, stands) =>
    playOrderStore.getState().commitNext(next, stands),
  placeOf: (advance) => {
    if (advance.kind !== ADVANCE.stems || advance.setlistItemId === null)
      return null;
    const { stage, cursor } = onStageNow();
    if (cursor === null) return null;
    return { number: cursor.index + 1, of: stage.entries.length };
  },
  candidates: () =>
    playOrderStore.getState().queue.length + onStageNow().stage.entries.length,
  commitOpen: (entry, stands) =>
    playOrderStore.getState().commitOpen(entry, stands),
  arrivals: arrivalStore,
});

type Arrive = (arrival: ArrivalEvent) => void;

const PLAYED = { settled: 'settled', tryNext: 'tryNext' } as const;

type Played = (typeof PLAYED)[keyof typeof PLAYED];

interface Tried {
  readonly played: Played;
  readonly by: PlayerKind;
}

async function openMetronome(
  deps: AutoAdvanceDeps,
  player: AdvancingPlayer,
  arrive: Arrive,
  entry: PresetSetlistEntry,
) {
  if (!(await deps.commitOpen(entry, player.stillEnded))) return;
  player.handToMetronome();
  arrive({ kind: ARRIVAL.metronome });
}

export function handOver(
  players: AdvancingPlayers,
  from: PlayerKind,
  song: QueuedSong,
): Promise<AdvanceOutcome> {
  players[from].handOver();
  return players[song.kind].takeOver(song.id);
}

export function handOverQueued(
  from: PlayerKind,
  song: QueuedSong,
  bars: WaveformBars,
): Promise<AdvanceOutcome> {
  return handOver(advancingPlayers(bars), from, song);
}

export function playQueuedNow(
  song: QueuedSong,
  bars: WaveformBars,
): Promise<AdvanceOutcome> {
  const players = advancingPlayers(bars);
  const from = playingKind();
  if (from === null) return players[song.kind].takeOver(song.id);
  const playing = players[from];
  if (song.kind === from && playing.playNow !== undefined)
    return playing.playNow(song.id);
  return handOver(players, from, song);
}

export function stopForMetronome(): void {
  const from = playingKind();
  if (from === 'stems') stemPlayerStore.getState().handToMetronome();
  if (from === 'song') songPlayerStore.getState().handToMetronome();
}

function startNext(
  players: AdvancingPlayers,
  from: PlayerKind,
  song: QueuedSong,
): Promise<AdvanceOutcome> {
  const player = players[from];
  if (song.kind === from && player.advanceTo !== undefined)
    return player.advanceTo(song.id);
  if (!player.stillEnded()) return Promise.resolve(ADVANCE_OUTCOME.displaced);
  return handOver(players, from, song);
}

interface Said {
  readonly skipped: SkippedSong | null;
  readonly inApp: boolean;
}

async function play(
  deps: AutoAdvanceDeps,
  arrive: Arrive,
  from: PlayerKind,
  next: PlayAdvance,
  said: Said,
): Promise<Tried> {
  const undo = await deps.commitNext(next, deps.players[from].stillEnded);
  if (undo === null) return { played: PLAYED.settled, by: from };
  const song = songOfPlay(next);
  const place = deps.placeOf(next);
  arrive({ kind: ARRIVAL.arriving, song });
  const outcome = await startNext(deps.players, from, song);
  if (outcome === ADVANCE_OUTCOME.displaced) await undo();
  if (outcome === ADVANCE_OUTCOME.playing)
    arrive({ kind: ARRIVAL.playing, song, place, ...said });
  return outcome === ADVANCE_OUTCOME.unplayable
    ? { played: PLAYED.tryNext, by: song.kind }
    : { played: PLAYED.settled, by: song.kind };
}

async function advance(
  deps: AutoAdvanceDeps,
  arrive: Arrive,
  ended: PlayerKind,
  cause: AdvanceCause,
) {
  let skipped: SkippedSong | null = null;
  let from = ended;
  for (let left = deps.candidates(); left > 0; left--) {
    const player = deps.players[from];
    if (!player.stillEnded()) return;
    const step = await deps.peekNext();
    if (!player.stillEnded()) return;
    if (step.skipped !== null)
      skipped = { reason: SKIP.deleted, kind: step.skipped };
    const next = step.advance;
    if (next.kind === ADVANCE.open && cause !== ADVANCE_CAUSE.ended) {
      await openMetronome(deps, player, arrive, next.entry);
      return;
    }
    if (!isPlayAdvance(next)) break;
    const tried = await play(deps, arrive, from, next, {
      skipped,
      inApp: cause === ADVANCE_CAUSE.nextInApp,
    });
    if (tried.played === PLAYED.settled) return;
    from = tried.by;
    skipped = { reason: SKIP.unopened, kind: tried.by };
  }
  deps.players[from].stopAdvancing();
  if (skipped?.reason === SKIP.deleted)
    arrive({ kind: ARRIVAL.gaveUp, skipped });
}

const PLAYER_KINDS: readonly PlayerKind[] = ['stems', 'song'];

export function startAutoAdvance(deps: AutoAdvanceDeps) {
  let serial = 0;
  let stepping = false;
  const arrive: Arrive = (arrival) => {
    serial++;
    deps.arrivals.setState({ arrival: { ...arrival, serial } });
  };
  const stops = PLAYER_KINDS.map((kind) =>
    deps.players[kind].onSongEnd((cause) => {
      if (stepping) return;
      stepping = true;
      advance(deps, arrive, kind, cause)
        .catch((error: unknown) => {
          console.warn('[kitbag] auto-advance failed', error);
        })
        .finally(() => {
          stepping = false;
        });
    }),
  );
  return () => {
    stops.forEach((stop) => {
      stop();
    });
  };
}
