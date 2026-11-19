import {
  MS_PER_SECOND,
  PRACTICE_LOG_VERSION,
  STRETCH_END,
  isStemSong,
  type LoggedPresetSong,
  type LoggedStemSong,
  type LoggedStretch,
  type PracticeLog,
  type StretchEnd,
} from '@kitbag/core-db';

import {
  IDLE_PRACTICE,
  practiceAfterRunning,
  practiceElapsedMs,
  type PracticeClock,
} from '../metronome/practice.ts';
import {
  closedStretch,
  isFolding,
  openStretch,
  refolded,
  stretchAfterSample,
  stretchAfterTempo,
  withLastEnd,
  withoutRecentTempo,
  type OpenStretch,
  type StretchPlace,
  type StretchSetup,
} from './stretch.ts';
import {
  averageBpm,
  sampled,
  startAverage,
  type TempoAverage,
} from './tempo.ts';

export const PRACTICE_TEMPO_SAMPLE_MS = 1000;
export const MIN_SAVED_PLAYED_MS = MS_PER_SECOND;

export type PracticeSong = LoggedPresetSong;
export type PracticeStemSong = LoggedStemSong;

export interface PracticeSetlist {
  readonly id: number;
  readonly name: string;
}

export interface PracticeStage extends PracticeSetlist {
  readonly uuid: string;
  readonly position: number | null;
  readonly itemId: number | null;
}

export interface PracticeContext {
  readonly setlist: PracticeStage | null;
  readonly song: PracticeSong | PracticeStemSong | null;
}

export interface PracticeStretch {
  readonly ms: number;
  readonly title: string | null;
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
  readonly open: OpenStretch | null;
  readonly stretches: readonly LoggedStretch[];
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

export interface PracticeRecording extends PracticeSummary {
  readonly log: PracticeLog;
}

function isPlaying(session: PracticeSession): boolean {
  return session.clock.stretchStartedAt !== null;
}

function placeOf({ song, setlist }: PracticeContext): StretchPlace {
  return {
    song,
    setlist:
      setlist === null
        ? null
        : {
            uuid: setlist.uuid,
            name: setlist.name,
            position: setlist.position,
          },
  };
}

function songKey(song: PracticeContext['song']): string | null {
  if (song === null) return null;
  return isStemSong(song) ? song.stemSongKey : song.uuid;
}

function samePlace(a: PracticeContext, b: PracticeContext): boolean {
  return (
    songKey(a.song) === songKey(b.song) &&
    a.setlist?.itemId === b.setlist?.itemId
  );
}

function isStageArriving(
  previous: PracticeContext,
  next: PracticeContext,
): boolean {
  return (
    previous.setlist === null &&
    next.setlist !== null &&
    songKey(previous.song) === songKey(next.song)
  );
}

function withOpenPlace(
  open: OpenStretch | null,
  context: PracticeContext,
): OpenStretch | null {
  return open === null ? null : { ...open, ...placeOf(context) };
}

function longer(
  longest: PracticeStretch | null,
  stretch: PracticeStretch,
): PracticeStretch {
  return longest !== null && longest.ms >= stretch.ms ? longest : stretch;
}

function withLongestClosed(
  session: PracticeSession,
  at: number,
): PracticeSession {
  const stretch = {
    ms: Math.max(0, at - session.songStretchFrom),
    title: session.context.song?.title ?? null,
  };
  return { ...session, longest: longer(session.longest, stretch) };
}

function withLogClosed(
  session: PracticeSession,
  at: number,
  end: StretchEnd,
  bpm: number,
): PracticeSession {
  const { open, startedAt, stretches } = session;
  if (open === null) return session;
  const closed = closedStretch(open, startedAt, at, end, bpm);
  return {
    ...session,
    open: null,
    stretches: closed === null ? stretches : [...stretches, closed],
  };
}

function withContextPlayed(session: PracticeSession): PracticeSession {
  const { song, setlist } = session.context;
  const fresh =
    song !== null &&
    !isStemSong(song) &&
    !session.songs.some((played) => played.uuid === song.uuid);
  const practiced =
    setlist === null ? null : { id: setlist.id, name: setlist.name };
  return {
    ...session,
    practicedSetlist: session.practicedSetlist ?? practiced,
    songs: fresh ? [...session.songs, song] : session.songs,
  };
}

export function startPracticeSession(
  uuid: string,
  at: number,
  bpm: number,
  context: PracticeContext,
  setup: StretchSetup,
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
    tempo: startAverage(at, bpm),
    open: openStretch(placeOf(context), setup, at, bpm),
    stretches: [],
  });
}

export function practiceSessionAfterPlay(
  session: PracticeSession,
  at: number,
  bpm: number,
  setup: StretchSetup,
): PracticeSession {
  if (isPlaying(session)) return session;
  return withContextPlayed({
    ...session,
    clock: practiceAfterRunning(session.clock, true, at),
    songStretchFrom: at,
    tempo: { ...session.tempo, bpm, sampledAt: at },
    open: openStretch(placeOf(session.context), setup, at, bpm),
  });
}

export function practiceSessionAfterPause(
  session: PracticeSession,
  at: number,
  bpm: number,
): PracticeSession {
  if (!isPlaying(session)) return session;
  const closed = withLogClosed(
    withLongestClosed(session, at),
    at,
    STRETCH_END.pause,
    bpm,
  );
  return {
    ...closed,
    clock: practiceAfterRunning(session.clock, false, at),
    tempo: { ...sampled(session.tempo, at, bpm), sampledAt: null },
  };
}

function withOpen(
  session: PracticeSession,
  next: (open: OpenStretch) => OpenStretch,
): PracticeSession {
  return session.open === null
    ? session
    : { ...session, open: next(session.open) };
}

export function practiceSessionAfterTempo(
  session: PracticeSession,
  at: number,
  bpm: number,
): PracticeSession {
  if (!isPlaying(session)) return session;
  return withOpen(
    { ...session, tempo: sampled(session.tempo, at, bpm) },
    (open) => stretchAfterSample(open, at, bpm),
  );
}

export function practiceSessionAfterTempoChange(
  session: PracticeSession,
  at: number,
  bpm: number,
  setup: StretchSetup,
): PracticeSession {
  if (!isPlaying(session)) return session;
  const place = placeOf(session.context);
  return withOpen(
    { ...session, tempo: sampled(session.tempo, at, bpm) },
    (open) =>
      isFolding(open, at)
        ? refolded(open, place, setup, bpm)
        : stretchAfterTempo(open, at, bpm),
  );
}

function reopened(
  session: PracticeSession,
  at: number,
  end: StretchEnd,
  bpm: number,
  setup: StretchSetup,
): PracticeSession {
  const { open } = session;
  const place = placeOf(session.context);
  if (open === null) return session;
  if (!isFolding(open, at)) {
    const outgoing =
      end === STRETCH_END.song
        ? withoutRecentTempo(open, at, bpm)
        : { open, bpm };
    return {
      ...withLogClosed(
        { ...session, open: outgoing.open },
        at,
        end,
        outgoing.bpm,
      ),
      open: openStretch(place, setup, at, bpm),
    };
  }
  const from = open.from - session.startedAt;
  return {
    ...session,
    open: refolded(open, place, setup, bpm),
    stretches:
      end === STRETCH_END.song
        ? withLastEnd(session.stretches, from, end)
        : session.stretches,
  };
}

export function practiceSessionAfterSettings(
  session: PracticeSession,
  at: number,
  bpm: number,
  setup: StretchSetup,
): PracticeSession {
  if (!isPlaying(session)) return session;
  return reopened(
    { ...session, tempo: sampled(session.tempo, at, bpm) },
    at,
    STRETCH_END.settings,
    bpm,
    setup,
  );
}

export function practiceSessionAfterContext(
  session: PracticeSession,
  context: PracticeContext,
  at: number,
  bpm: number,
  setup: StretchSetup,
): PracticeSession {
  if (!isPlaying(session)) return { ...session, context };
  if (samePlace(session.context, context))
    return withContextPlayed({ ...session, context });
  if (isStageArriving(session.context, context))
    return withContextPlayed({
      ...session,
      context,
      open: withOpenPlace(session.open, context),
    });
  const songChanged = songKey(session.context.song) !== songKey(context.song);
  const closed = songChanged
    ? { ...withLongestClosed(session, at), songStretchFrom: at }
    : session;
  return withContextPlayed(
    reopened({ ...closed, context }, at, STRETCH_END.song, bpm, setup),
  );
}

export function endPracticeSession(
  session: PracticeSession,
  at: number,
  bpm: number,
): PracticeRecording {
  const paused = practiceSessionAfterPause(
    withLogClosed(session, at, STRETCH_END.end, bpm),
    at,
    bpm,
  );
  return {
    uuid: paused.uuid,
    startedAt: paused.startedAt,
    playedMs: practiceElapsedMs(paused.clock, at),
    setlist: paused.practicedSetlist,
    songs: paused.songs,
    avgBpm: averageBpm(paused.tempo),
    longestStretch: paused.longest,
    log: { v: PRACTICE_LOG_VERSION, stretches: paused.stretches },
  };
}
