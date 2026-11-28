import { MS_PER_SECOND } from '@kitbag/core-db';
import type { MediaSessionSnapshot } from '@kitbag/core-native';

import type { StoreAccess } from '../configuredStore.ts';
import { median } from '../rig/calibrationStats.ts';
import { SEEK_JUMP_MS } from './follower.ts';
import { chosenSession } from './libraryOffer.ts';
import { lockBeatsPerBar, shiftedDownbeatSec, tapPhase } from './phase.ts';
import { barSeconds, extrapolatedPositionMs } from './position.ts';
import type { PlayAlongRuntime } from './runtime.ts';
import type { PlayAlongLock, PlayAlongStore } from './store.ts';
import {
  NO_TAPS,
  ONE_SET_SHOWN_MS,
  TAP_STEP,
  TAP_STOP_BEATS,
  TAP_STOP_MIN_MS,
  TAPS_CLEARED,
  type TapAlong,
  type TapAlongActions,
  type TappedTempo,
} from './tapAlongState.ts';
import {
  beatsToOne,
  firstTapDownbeatMs,
  halfOrDoubleBpm,
  keptOneMs,
  songGrid,
} from './tapDownbeat.ts';
import {
  BEAT_SOURCE,
  beatLengthMs,
  TAP_LOCK_MISS,
  TAP_LOCK_WINDOW,
  tapLock,
  tapOffsets,
  type SongTempo,
  type TapLocked,
} from './tapLock.ts';
import {
  findSession,
  sameTrack,
  trackOf,
  type PlayAlongTrack,
} from './track.ts';

type Timer = ReturnType<typeof setTimeout> | undefined;

interface TapAlongDeps {
  readonly lockOn: (seen: MediaSessionSnapshot, lock: PlayAlongLock) => void;
  readonly showBpm: (bpm: number) => void;
  readonly moveDownbeat: (beats: number) => boolean;
}

interface Watch {
  readonly stop: () => void;
  readonly track: PlayAlongTrack;
  seen: MediaSessionSnapshot;
}

function jumped(
  before: MediaSessionSnapshot,
  after: MediaSessionSnapshot,
  nowMs: number,
): boolean {
  const expected = extrapolatedPositionMs(before, nowMs);
  const reported = extrapolatedPositionMs(after, nowMs);
  return (
    expected !== null &&
    reported !== null &&
    Math.abs(reported - expected) > SEEK_JUMP_MS
  );
}

function stopWaitMs(taps: readonly number[]): number {
  const gaps = taps.slice(1).map((t, i) => t - (taps[i] ?? t));
  const beatMs = gaps.length === 0 ? 0 : median(gaps);
  return Math.max(TAP_STOP_BEATS * beatMs, TAP_STOP_MIN_MS);
}

function clickDownbeatMs(lock: PlayAlongLock, denominator: number): number {
  const sec = shiftedDownbeatSec(
    lock.downbeatSec,
    lock.downbeatShift,
    lock.bpm,
    denominator,
  );
  return sec * MS_PER_SECOND - lock.phaseOffsetMs;
}

export function tapAlongActions(
  runtime: PlayAlongRuntime,
  { getState, setState }: StoreAccess<PlayAlongStore>,
  deps: TapAlongDeps,
) {
  let stopTimer: Timer;
  let shownTimer: Timer;
  let watch: Watch | undefined;

  const update = (change: Partial<TapAlong>) => {
    setState({ tapAlong: { ...getState().tapAlong, ...change } });
  };
  const reset = (change: Partial<TapAlong> = {}) => {
    clearTimeout(stopTimer);
    clearTimeout(shownTimer);
    watch?.stop();
    watch = undefined;
    setState({ tapAlong: { ...NO_TAPS, ...change } });
  };
  const songNow = (): SongTempo => {
    const { lock, bpm, pattern } = getState();
    return { bpm: lock?.bpm ?? bpm ?? null, denominator: pattern.denominator };
  };
  const beatsPerBar = () => getState().pattern.beatsPerBar;

  const onSessions = (sessions: readonly MediaSessionSnapshot[]) => {
    const current = watch;
    if (current === undefined) return;
    const seen = findSession(sessions, current.seen.sessionId);
    if (seen === undefined || !sameTrack(current.track, seen))
      reset({ cleared: TAPS_CLEARED.track });
    else if (jumped(current.seen, seen, runtime.boottimeNowMs()))
      reset({ cleared: TAPS_CLEARED.seek });
    else current.seen = seen;
  };

  const startWatching = (seen: MediaSessionSnapshot) => {
    if (watch !== undefined) return;
    const stop = runtime.sessions().subscribe((state, previous) => {
      if (state.sessions !== previous.sessions) onSessions(state.sessions);
    });
    watch = { stop, track: trackOf(seen), seen };
  };

  const lockFromTaps = (
    seen: MediaSessionSnapshot,
    bpm: number,
    downbeatMs: number,
    tapped: TappedTempo | undefined,
  ) => {
    deps.lockOn(seen, {
      sessionId: seen.sessionId,
      track: trackOf(seen),
      downbeatSec: downbeatMs / MS_PER_SECOND,
      bpm,
      lockedAtBoottimeMs: runtime.boottimeNowMs(),
      grid: undefined,
      tapped,
      ...tapPhase(),
    });
  };

  const firstTap = (fallbackMs: number) =>
    getState().tapAlong.taps[0] ?? fallbackMs;

  const freshLock = (seen: MediaSessionSnapshot, result: TapLocked) => {
    if (result.bpm !== getState().bpm) deps.showBpm(result.bpm);
    const downbeatMs = firstTapDownbeatMs(
      result,
      firstTap(result.anchorMs),
      beatsPerBar(),
    );
    lockFromTaps(seen, result.bpm, downbeatMs, {
      beatSource: result.beatSource,
      keptTaps: result.keptTaps,
    });
    reset({
      step: TAP_STEP.chooseOne,
      halfOrDoubleBpm: halfOrDoubleBpm(result),
    });
  };

  const retapped = (
    seen: MediaSessionSnapshot,
    lock: PlayAlongLock,
    result: TapLocked,
  ) => {
    const { denominator } = getState().pattern;
    const oldMs =
      shiftedDownbeatSec(
        lock.downbeatSec,
        lock.downbeatShift,
        lock.bpm,
        denominator,
      ) * MS_PER_SECOND;
    const barMs =
      barSeconds(lock.bpm, beatsPerBar(), denominator) * MS_PER_SECOND;
    lockFromTaps(seen, lock.bpm, keptOneMs(oldMs, barMs, result), lock.tapped);
    reset();
  };

  const disagreed = (seen: MediaSessionSnapshot, song: SongTempo): boolean => {
    const { taps } = getState().tapAlong;
    const tapped = tapLock(taps, { bpm: null, denominator: song.denominator });
    if (!tapped.locked || song.bpm === null) {
      update({ result: tapped });
      return false;
    }
    const first = firstTap(tapped.anchorMs);
    const songBeatMs = beatLengthMs(song.bpm, song.denominator);
    const songMs = firstTapDownbeatMs(
      songGrid(tapped.anchorMs, songBeatMs),
      first,
      beatsPerBar(),
    );
    const keptTaps = tapped.keptTaps;
    lockFromTaps(seen, song.bpm, songMs, {
      beatSource: BEAT_SOURCE.song,
      keptTaps,
    });
    const tappedMs = firstTapDownbeatMs(tapped, first, beatsPerBar());
    reset({
      step: TAP_STEP.chooseTempo,
      tempoChoice: {
        tappedBpm: tapped.bpm,
        songBpm: song.bpm,
        keptTaps,
        tappedDownbeatSec: tappedMs / MS_PER_SECOND,
      },
    });
    return true;
  };

  const commit = (): boolean => {
    clearTimeout(stopTimer);
    const seen = chosenSession(runtime);
    const { lock, tapAlong } = getState();
    if (seen?.playing !== true || tapAlong.step !== TAP_STEP.tapping)
      return false;
    const song = songNow();
    const result = tapLock(tapAlong.taps, song);
    if (result.locked) {
      if (lock === undefined) freshLock(seen, result);
      else retapped(seen, lock, result);
      return true;
    }
    if (result.reason === TAP_LOCK_MISS.disagrees && lock === undefined)
      return disagreed(seen, song);
    update({ result });
    return false;
  };

  const collect = (seen: MediaSessionSnapshot, songMs: number): boolean => {
    const taps = [...getState().tapAlong.taps, songMs].slice(-TAP_LOCK_WINDOW);
    const song = songNow();
    const result = tapLock(taps, song);
    update({
      taps,
      offsets: tapOffsets(taps, song),
      result,
      cleared: undefined,
    });
    startWatching(seen);
    if (result.locked && result.keptTaps >= TAP_LOCK_WINDOW) return commit();
    clearTimeout(stopTimer);
    stopTimer = setTimeout(commit, stopWaitMs(taps));
    return false;
  };

  const chooseOne = (songMs: number): boolean => {
    const { lock, pattern } = getState();
    if (lock === undefined) return false;
    const beats = beatsToOne(
      clickDownbeatMs(lock, pattern.denominator),
      beatLengthMs(lock.bpm, pattern.denominator),
      songMs,
      lockBeatsPerBar(lock.grid, pattern),
    );
    if (!deps.moveDownbeat(beats)) return false;
    update({ step: TAP_STEP.oneSet, movedBeats: beats });
    clearTimeout(shownTimer);
    shownTimer = setTimeout(reset, ONE_SET_SHOWN_MS);
    return true;
  };

  const tapToLock = (atBoottimeMs: number): boolean => {
    const seen = chosenSession(runtime);
    if (seen?.playing !== true) return false;
    const songMs = extrapolatedPositionMs(seen, atBoottimeMs);
    if (songMs === null) return false;
    const { step } = getState().tapAlong;
    if (step === TAP_STEP.chooseOne) return chooseOne(songMs);
    return step === TAP_STEP.tapping && collect(seen, songMs);
  };

  const actions: TapAlongActions = {
    tapToLock,
    askForOne: () => {
      if (getState().lock?.downbeatShiftAvailable === true)
        reset({ step: TAP_STEP.chooseOne });
    },
    keepAccent: () => {
      if (getState().tapAlong.step === TAP_STEP.chooseOne) reset();
    },
    chooseTappedTempo: () => {
      const { lock, tapAlong } = getState();
      const choice = tapAlong.tempoChoice;
      if (lock === undefined || choice === undefined) return;
      setState({
        lock: {
          ...lock,
          downbeatSec: choice.tappedDownbeatSec,
          tapped: { beatSource: BEAT_SOURCE.taps, keptTaps: choice.keptTaps },
        },
      });
      deps.showBpm(choice.tappedBpm);
      reset({ step: TAP_STEP.chooseOne });
    },
    chooseSongTempo: () => {
      if (getState().tapAlong.tempoChoice !== undefined)
        reset({ step: TAP_STEP.chooseOne });
    },
    startTapsOver: () => {
      reset();
    },
    forgetClearedTaps: () => {
      update({ cleared: undefined });
    },
  };

  return { actions, reset };
}
