import { MS_PER_SECOND } from '@kitbag/core-db';
import type { MediaSessionSnapshot } from '@kitbag/core-native';

import type { StoreAccess } from '../configuredStore.ts';
import { median } from '../rig/calibrationStats.ts';
import { BPM_SOURCE } from '../tempoLadder/sources.ts';
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
  type TapAlong,
  type TapAlongActions,
  type TappedTempo,
} from './tapAlongState.ts';
import {
  beatGrid,
  firstTapDownbeatMs,
  gridBeatsToOne,
  halfOrDoubleBpm,
  keptOneMs,
  oneFromTap,
} from './tapDownbeat.ts';
import {
  BEAT_SOURCE,
  beatLengthMs,
  gaps,
  TAP_LOCK_MISS,
  TAP_LOCK_WINDOW,
  tapLock,
  tapOffsets,
  type SongTempo,
  type TapLocked,
  type TapLockResult,
} from './tapLock.ts';
import { tapWatch } from './tapWatch.ts';
import { trackOf } from './track.ts';

type Timer = ReturnType<typeof setTimeout> | undefined;

interface TapAlongDeps {
  readonly lockOn: (seen: MediaSessionSnapshot, lock: PlayAlongLock) => void;
  readonly showBpm: (bpm: number) => void;
  readonly moveDownbeat: (beats: number) => boolean;
  readonly anchor: () => void;
}

interface OneGuard {
  readonly lastTapMs: number;
  readonly quietMs: number;
}

function stopWaitMs(taps: readonly number[]): number {
  const beatMs = taps.length < 2 ? 0 : median(gaps(taps, 1));
  return Math.max(TAP_STOP_BEATS * beatMs, TAP_STOP_MIN_MS);
}

export const shiftedDownbeatMs = (
  lock: PlayAlongLock,
  denominator: number,
): number =>
  shiftedDownbeatSec(
    lock.downbeatSec,
    lock.downbeatShift,
    lock.bpm,
    denominator,
  ) * MS_PER_SECOND;

function steadyAtTappedTempo(
  taps: readonly number[],
  song: SongTempo,
): boolean {
  const own = tapLock(taps, { bpm: null, denominator: song.denominator });
  return own.locked && own.keptTaps >= TAP_LOCK_WINDOW;
}

function asksForTempo(
  result: TapLockResult,
  taps: readonly number[],
  song: SongTempo,
): boolean {
  if (result.locked) return false;
  if (result.reason === TAP_LOCK_MISS.disagrees) return true;
  return (
    result.reason === TAP_LOCK_MISS.unsure && steadyAtTappedTempo(taps, song)
  );
}

export function tapAlongActions(
  runtime: PlayAlongRuntime,
  { getState, setState }: StoreAccess<PlayAlongStore>,
  deps: TapAlongDeps,
) {
  let stopTimer: Timer;
  let shownTimer: Timer;
  let firstTapMs: number | undefined;
  let oneGuard: OneGuard | undefined;

  const update = (change: Partial<TapAlong>) => {
    setState({ tapAlong: { ...getState().tapAlong, ...change } });
  };
  const watch = tapWatch(runtime, (cleared) => {
    reset({ cleared });
  });
  const reset = (change: Partial<TapAlong> = {}) => {
    clearTimeout(stopTimer);
    clearTimeout(shownTimer);
    watch.stop();
    firstTapMs = undefined;
    oneGuard = undefined;
    setState({ tapAlong: { ...NO_TAPS, ...change } });
  };
  const songNow = (): SongTempo => {
    const { lock, bpm, pattern } = getState();
    return { bpm: lock?.bpm ?? bpm ?? null, denominator: pattern.denominator };
  };
  const beatsPerBar = () => getState().pattern.beatsPerBar;
  const enterTappedTempo = (bpm: number) => {
    runtime.ladder().getState().enter(bpm, BPM_SOURCE.tap);
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

  const freshLock = (seen: MediaSessionSnapshot, result: TapLocked) => {
    const { taps } = getState().tapAlong;
    const first = firstTapMs ?? result.anchorMs;
    const guard = {
      lastTapMs: taps.at(-1) ?? first,
      quietMs: stopWaitMs(taps),
    };
    if (result.bpm !== getState().bpm) deps.showBpm(result.bpm);
    const downbeatMs = firstTapDownbeatMs(result, first, beatsPerBar());
    const { beatSource, keptTaps } = result;
    lockFromTaps(seen, result.bpm, downbeatMs, { beatSource, keptTaps });
    if (beatSource === BEAT_SOURCE.taps) enterTappedTempo(result.bpm);
    reset({
      step: TAP_STEP.chooseOne,
      halfOrDoubleBpm: halfOrDoubleBpm(result),
    });
    oneGuard = guard;
  };

  const retapped = (
    seen: MediaSessionSnapshot,
    lock: PlayAlongLock,
    result: TapLocked,
  ) => {
    const { denominator } = getState().pattern;
    const oldMs = shiftedDownbeatMs(lock, denominator);
    const barMs =
      barSeconds(lock.bpm, beatsPerBar(), denominator) * MS_PER_SECOND;
    lockFromTaps(seen, lock.bpm, keptOneMs(oldMs, barMs, result), lock.tapped);
    reset();
  };

  const askTempo = (seen: MediaSessionSnapshot, song: SongTempo): boolean => {
    const { taps } = getState().tapAlong;
    const tapped = tapLock(taps, { bpm: null, denominator: song.denominator });
    if (!tapped.locked || song.bpm === null) {
      update({ result: tapped });
      return false;
    }
    const first = firstTapMs ?? tapped.anchorMs;
    const songBeatMs = beatLengthMs(song.bpm, song.denominator);
    const songMs = firstTapDownbeatMs(
      beatGrid(tapped.anchorMs, songBeatMs),
      first,
      beatsPerBar(),
    );
    const tappedMs = firstTapDownbeatMs(tapped, first, beatsPerBar());
    const { keptTaps } = tapped;
    lockFromTaps(seen, song.bpm, songMs, {
      beatSource: BEAT_SOURCE.song,
      keptTaps,
    });
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
    if (lock === undefined && asksForTempo(result, tapAlong.taps, song))
      return askTempo(seen, song);
    update({ result });
    return false;
  };

  const readyNow = (result: TapLockResult, taps: readonly number[]) => {
    if (result.locked) return result.keptTaps >= TAP_LOCK_WINDOW;
    return (
      getState().lock === undefined &&
      result.reason === TAP_LOCK_MISS.unsure &&
      steadyAtTappedTempo(taps, songNow())
    );
  };

  const collect = (seen: MediaSessionSnapshot, songMs: number): boolean => {
    firstTapMs ??= songMs;
    const taps = [...getState().tapAlong.taps, songMs].slice(-TAP_LOCK_WINDOW);
    const song = songNow();
    const result = tapLock(taps, song);
    const offsets = tapOffsets(taps, song, result);
    update({ taps, offsets, result, cleared: undefined });
    watch.start(seen);
    if (readyNow(result, taps)) return commit();
    clearTimeout(stopTimer);
    stopTimer = setTimeout(commit, stopWaitMs(taps));
    return false;
  };

  const oneOnTapLock = (lock: PlayAlongLock, songMs: number): number => {
    const { denominator } = getState().pattern;
    // The click runs phaseOffsetMs ahead of the song (follower placeClick).
    const onClickMs = songMs + lock.phaseOffsetMs;
    const picked = oneFromTap(
      shiftedDownbeatMs(lock, denominator),
      beatLengthMs(lock.bpm, denominator),
      onClickMs,
      beatsPerBar(),
    );
    setState({
      lock: {
        ...lock,
        downbeatSec: picked.downbeatMs / MS_PER_SECOND,
        downbeatShift: 0,
      },
    });
    deps.anchor();
    return picked.movedBeats;
  };

  const oneOnGridLock = (
    lock: PlayAlongLock,
    songMs: number,
  ): number | undefined => {
    const { grid } = lock;
    if (grid === undefined) return undefined;
    const beats = gridBeatsToOne(
      grid.beats,
      lock.gridDownbeats ?? grid.downbeatIndices,
      (songMs + lock.phaseOffsetMs) / MS_PER_SECOND,
      lockBeatsPerBar(grid, getState().pattern),
    );
    return deps.moveDownbeat(beats) ? beats : undefined;
  };

  const stillTapping = (songMs: number): boolean => {
    const guard = oneGuard;
    if (guard === undefined || songMs - guard.lastTapMs >= guard.quietMs)
      return false;
    oneGuard = { ...guard, lastTapMs: songMs };
    return true;
  };

  const chooseOne = (songMs: number): boolean => {
    const { lock } = getState();
    if (lock === undefined || stillTapping(songMs)) return false;
    oneGuard = undefined;
    const moved =
      lock.grid === undefined
        ? oneOnTapLock(lock, songMs)
        : oneOnGridLock(lock, songMs);
    if (moved === undefined) return false;
    update({ step: TAP_STEP.oneSet, movedBeats: moved });
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

  const chooseTappedTempo = () => {
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
    enterTappedTempo(choice.tappedBpm);
    reset({ step: TAP_STEP.chooseOne });
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
    chooseTappedTempo,
    chooseSongTempo: () => {
      if (getState().tapAlong.tempoChoice !== undefined)
        reset({ step: TAP_STEP.chooseOne });
    },
    startTapsOver: () => {
      reset();
    },
    dropRetapTaps: () => {
      const { lock, tapAlong } = getState();
      if (
        lock !== undefined &&
        tapAlong.step === TAP_STEP.tapping &&
        tapAlong.taps.length > 0
      )
        reset();
    },
    forgetClearedTaps: () => {
      update({ cleared: undefined });
    },
  };

  return { actions, reset };
}
