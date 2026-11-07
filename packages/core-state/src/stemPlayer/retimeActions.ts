import type { LyricLineTimes } from '@kitbag/core-db';
import { KB_RESULT } from '@kitbag/core-native';

import {
  sungLineFrom,
  hasRealTime,
  NO_LINE,
  retimedTimes,
  retimeLineAt,
  shiftedTimes,
  timedOnly,
  takeAfterTap,
  withTimes,
} from './lyrics.ts';
import type { StemPlayerRecords } from './runtime.ts';
import { sessionGate } from './sessionGate.ts';
import type { ActionContext, StemPlayerActions } from './store.ts';
import { framesToSeconds } from './time.ts';

function writeTiming(
  records: StemPlayerRecords,
  setId: number,
  stored: LyricLineTimes | null,
): Promise<number> {
  return records.saveLyricsRetimed(setId, stored).then(
    () => KB_RESULT.KB_OK,
    (error: unknown) => {
      console.warn('[kitbag] lyric timing not stored', error);
      return KB_RESULT.KB_ERROR_INTERNAL;
    },
  );
}

export function retimeAnchor({
  set,
  get,
}: Pick<ActionContext, 'set' | 'get'>): (frame: number) => void {
  return (frame) => {
    const { retime, lyrics, engineRate } = get();
    if (retime.kind !== 'recording' || retime.taps.length > 0) return;
    const { lines } = lyrics;
    const songSec = framesToSeconds(frame, engineRate);
    const nextLine = retimeLineAt(lines, songSec);
    if (nextLine !== retime.nextLine) set({ retime: { ...retime, nextLine } });
  };
}

export function retimeActions({
  set,
  get,
  runtimeOf,
  session,
}: ActionContext): Pick<
  StemPlayerActions,
  | 'beginRetime'
  | 'tapRetime'
  | 'undoRetimeTap'
  | 'shiftRetime'
  | 'commitRetime'
  | 'cancelRetime'
  | 'leaveRetime'
  | 'resetRetime'
> {
  const { busy, call } = sessionGate(session);

  const saveTiming = async (
    shown: LyricLineTimes,
    stored: LyricLineTimes | null,
  ) => {
    const { setId } = get();
    if (setId === null) return;
    const { records } = runtimeOf();
    set({ retimeFailure: null });
    const { result, live } = await call(() =>
      writeTiming(records, setId, stored),
    );
    if (!live) return;
    if (result !== KB_RESULT.KB_OK) {
      set({ retimeFailure: 'notStored' });
      return;
    }
    const { lyrics, leaveRetime } = get();
    set({
      lyrics: {
        ...lyrics,
        lines: withTimes(lyrics.lines, shown),
        synced: hasRealTime(shown),
        retimed: stored !== null,
      },
    });
    leaveRetime();
  };

  return {
    beginRetime: (fromLine) => {
      if (busy()) return;
      const { lyrics, togglePlay } = get();
      const nextLine = sungLineFrom(lyrics.lines, fromLine);
      if (nextLine === NO_LINE) return;
      set({
        retime: { kind: 'recording', taps: [], nextLine, shiftSteps: 0 },
        retimeFailure: null,
      });
      if (!runtimeOf().engine.playing()) togglePlay();
    },
    tapRetime: () => {
      const { retime, lyrics, engineRate } = get();
      if (retime.kind !== 'recording' || busy()) return;
      const timeSec = framesToSeconds(
        runtimeOf().engine.position(),
        engineRate,
      );
      const take = takeAfterTap(lyrics.lines, retime, timeSec);
      if (take !== null) set({ retime: { ...retime, ...take } });
    },
    undoRetimeTap: () => {
      const { retime } = get();
      if (retime.kind !== 'recording' || busy()) return;
      const last = retime.taps.at(-1);
      if (last === undefined) return;
      set({
        retime: {
          ...retime,
          taps: retime.taps.slice(0, -1),
          nextLine: last.line,
        },
      });
    },
    shiftRetime: (steps) => {
      const { retime } = get();
      if (retime.kind !== 'recording' || busy()) return;
      set({
        retime: { ...retime, shiftSteps: retime.shiftSteps + steps },
      });
    },
    commitRetime: async () => {
      const { retime, lyrics, leaveRetime } = get();
      if (retime.kind !== 'recording' || busy()) return;
      const times = shiftedTimes(
        retimedTimes(lyrics.lines, retime.taps),
        retime.shiftSteps,
      );
      if (times.every((time, i) => time === lyrics.lines[i]?.timeSec)) {
        leaveRetime();
        return;
      }
      await saveTiming(times, timedOnly(times));
    },
    cancelRetime: () => {
      if (!busy()) get().leaveRetime();
    },
    leaveRetime: () => {
      set({ retime: { kind: 'off' }, retimeFailure: null });
    },
    resetRetime: async () => {
      const { status, lyrics } = get();
      if (status !== 'ready' || busy()) return;
      await saveTiming(lyrics.bundledTimes, null);
    },
  };
}
