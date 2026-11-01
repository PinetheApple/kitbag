import { MS_PER_SECOND } from '@kitbag/core-db';

import {
  IDLE_PRACTICE,
  practiceAfterRunning,
  practiceElapsedMs,
  type PracticeClock,
} from '../metronome/practice.ts';

export const PRACTICE_TEMPO_SAMPLE_MS = 1000;
export const MIN_SAVED_PLAYED_MS = MS_PER_SECOND;

export interface PracticeSong {
  readonly uuid: string;
  readonly title: string;
}

export interface PracticeSetlist {
  readonly id: number;
  readonly name: string;
}

export interface PracticeContext {
  readonly setlist: PracticeSetlist | null;
  readonly song: PracticeSong | null;
}

export interface PracticeStretch {
  readonly ms: number;
  readonly title: string | null;
}

interface TempoAverage {
  readonly bpmMs: number;
  readonly ms: number;
  readonly bpm: number;
  readonly sampledAt: number | null;
}

export interface PracticeSession {
  readonly uuid: string;
  readonly startedAt: number;
  readonly clock: PracticeClock;
  readonly songStretchFrom: number;
  readonly context: PracticeContext;
  readonly practicedSetlist: PracticeSetlist | null;
  readonly songs: readonly PracticeSong[];
  readonly longest: PracticeStretch | null;
  readonly tempo: TempoAverage;
}

export interface PracticeSummary {
  readonly uuid: string;
  readonly startedAt: number;
  readonly playedMs: number;
  readonly setlist: PracticeSetlist | null;
  readonly songs: readonly PracticeSong[];
  readonly avgBpm: number;
  readonly longestStretch: PracticeStretch | null;
}

function isPlaying(session: PracticeSession): boolean {
  return session.clock.stretchStartedAt !== null;
}

function sampled(tempo: TempoAverage, at: number, bpm: number): TempoAverage {
  if (tempo.sampledAt === null) return { ...tempo, bpm, sampledAt: at };
  const elapsed = Math.max(0, at - tempo.sampledAt);
  return {
    bpmMs: tempo.bpmMs + tempo.bpm * elapsed,
    ms: tempo.ms + elapsed,
    bpm,
    sampledAt: at,
  };
}

function longer(
  longest: PracticeStretch | null,
  stretch: PracticeStretch,
): PracticeStretch {
  return longest !== null && longest.ms >= stretch.ms ? longest : stretch;
}

function withStretchClosed(
  session: PracticeSession,
  at: number,
): PracticeSession {
  const stretch = {
    ms: Math.max(0, at - session.songStretchFrom),
    title: session.context.song?.title ?? null,
  };
  return { ...session, longest: longer(session.longest, stretch) };
}

function withContextPlayed(session: PracticeSession): PracticeSession {
  const { song, setlist } = session.context;
  const known =
    song === null || session.songs.some((played) => played.uuid === song.uuid);
  return {
    ...session,
    practicedSetlist: session.practicedSetlist ?? setlist,
    songs: known ? session.songs : [...session.songs, song],
  };
}

export function startPracticeSession(
  uuid: string,
  at: number,
  bpm: number,
  context: PracticeContext,
): PracticeSession {
  return withContextPlayed({
    uuid,
    startedAt: at,
    clock: practiceAfterRunning(IDLE_PRACTICE, true, at),
    songStretchFrom: at,
    context,
    practicedSetlist: null,
    songs: [],
    longest: null,
    tempo: { bpmMs: 0, ms: 0, bpm, sampledAt: at },
  });
}

export function practiceSessionAfterRunning(
  session: PracticeSession,
  running: boolean,
  at: number,
  bpm: number,
): PracticeSession {
  if (running === isPlaying(session)) return session;
  if (running)
    return withContextPlayed({
      ...session,
      clock: practiceAfterRunning(session.clock, true, at),
      songStretchFrom: at,
      tempo: { ...session.tempo, bpm, sampledAt: at },
    });
  const closed = withStretchClosed(session, at);
  return {
    ...closed,
    clock: practiceAfterRunning(session.clock, false, at),
    tempo: { ...sampled(session.tempo, at, bpm), sampledAt: null },
  };
}

export function practiceSessionAfterTempo(
  session: PracticeSession,
  at: number,
  bpm: number,
): PracticeSession {
  if (!isPlaying(session)) return session;
  return { ...session, tempo: sampled(session.tempo, at, bpm) };
}

function sameSong(a: PracticeSong | null, b: PracticeSong | null): boolean {
  return a?.uuid === b?.uuid;
}

export function practiceSessionAfterContext(
  session: PracticeSession,
  context: PracticeContext,
  at: number,
): PracticeSession {
  if (!isPlaying(session)) return { ...session, context };
  if (sameSong(session.context.song, context.song))
    return withContextPlayed({ ...session, context });
  const closed = withStretchClosed(session, at);
  return withContextPlayed({ ...closed, context, songStretchFrom: at });
}

export function endPracticeSession(
  session: PracticeSession,
  at: number,
  bpm: number,
): PracticeSummary {
  const ended = practiceSessionAfterRunning(session, false, at, bpm);
  const { tempo } = ended;
  return {
    uuid: ended.uuid,
    startedAt: ended.startedAt,
    playedMs: practiceElapsedMs(ended.clock, at),
    setlist: ended.practicedSetlist,
    songs: ended.songs,
    avgBpm: tempo.ms > 0 ? tempo.bpmMs / tempo.ms : tempo.bpm,
    longestStretch: ended.longest,
  };
}
