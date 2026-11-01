import type { RetimedLyrics } from '@kitbag/core-db';

import { NO_LINE, nextSungLine, retimedTimes, withTimes } from './lyrics.ts';
import type { ActionContext, StemPlayerActions } from './store.ts';
import { framesToSeconds } from './time.ts';

const RETIME_OFF = { kind: 'off' } as const;

export function retimeActions({
  set,
  get,
  runtimeOf,
  session,
}: ActionContext): Pick<
  StemPlayerActions,
  'beginRetime' | 'tapRetime' | 'commitRetime' | 'cancelRetime' | 'resetRetime'
> {
  const saveTiming = async (times: RetimedLyrics, retimed: boolean) => {
    const { setId, lyrics } = get();
    if (setId === null) return;
    const opened = session();
    set({
      lyrics: { ...lyrics, lines: withTimes(lyrics.lines, times), retimed },
      retime: RETIME_OFF,
    });
    try {
      await runtimeOf().records.saveLyricsRetimed(
        setId,
        retimed ? times : null,
      );
    } catch (error: unknown) {
      console.warn('[kitbag] lyric timing not stored', error);
      if (opened === session()) set({ lyrics });
    }
  };

  return {
    beginRetime: (fromLine) => {
      const nextLine = nextSungLine(get().lyrics.lines, fromLine);
      if (nextLine === NO_LINE) return;
      set({ retime: { kind: 'recording', taps: [], nextLine } });
    },
    tapRetime: () => {
      const { retime, lyrics, engineRate } = get();
      if (retime.kind !== 'recording' || retime.nextLine === NO_LINE) return;
      const timeSec = framesToSeconds(
        runtimeOf().engine.position(),
        engineRate,
      );
      const last = retime.taps.at(-1);
      if (last !== undefined && timeSec <= last.timeSec) return;
      set({
        retime: {
          kind: 'recording',
          taps: [...retime.taps, { line: retime.nextLine, timeSec }],
          nextLine: nextSungLine(lyrics.lines, retime.nextLine + 1),
        },
      });
    },
    commitRetime: async () => {
      const { retime, lyrics } = get();
      if (retime.kind !== 'recording' || retime.taps.length === 0) {
        set({ retime: RETIME_OFF });
        return;
      }
      await saveTiming(retimedTimes(lyrics.lines, retime.taps), true);
    },
    cancelRetime: () => {
      set({ retime: RETIME_OFF });
    },
    resetRetime: async () => {
      await saveTiming(get().lyrics.bundled, false);
    },
  };
}
