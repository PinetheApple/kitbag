import type { QueuedSong } from '@kitbag/core-db';

import { sessionStemEntry } from '../library/setlistSession.ts';
import type { LibraryStore } from '../library/store.ts';
import { warn } from '../songLibrary/storeSupport.ts';
import type { HeldStart } from '../stemPlayer/loop.ts';
import { ADVANCE_OUTCOME, type AdvanceOutcome } from '../stemPlayer/songEnd.ts';

export type ViewLibrary = Pick<
  LibraryStore,
  'session' | 'entries' | 'endSetlistSession' | 'openStemEntry'
>;

export interface ViewSessionOptions {
  readonly kind: QueuedSong['kind'];
  readonly library: () => ViewLibrary;
  readonly viewedId: () => number | null;
  readonly held: () => HeldStart;
  readonly opening: (id: number, waveformBars: number) => void;
  readonly show: (opened: number, id: number, bars: number) => Promise<void>;
  readonly failed: () => void;
  readonly closing: () => void;
  readonly takeOver: (
    id: number,
    bars: number,
    held: HeldStart,
  ) => Promise<AdvanceOutcome>;
  readonly flush?: () => void;
}

export function viewSession({
  kind,
  library,
  viewedId,
  held,
  opening,
  show,
  failed,
  closing,
  takeOver,
  flush,
}: ViewSessionOptions) {
  let viewing = 0;
  let bars = 0;
  let starting = false;
  const writes = new Set<Promise<void>>();
  const live = (opened: number) => opened === viewing;

  const track = (write: Promise<unknown>) => {
    const settled = write.then(
      () => undefined,
      () => undefined,
    );
    writes.add(settled);
    void settled.then(() => writes.delete(settled));
  };

  const followSetlist = async (id: number) => {
    const state = library();
    const entry = kind === 'stems' ? sessionStemEntry(state, id) : undefined;
    if (entry === undefined || state.session === null) {
      state.endSetlistSession();
      return;
    }
    await state.openStemEntry(entry.item.id, state.session.setlistId);
  };

  const leave = () => {
    flush?.();
    viewing++;
    closing();
  };

  return {
    live,
    current: () => viewing,
    track,
    save: (write: Promise<unknown>, what: string) => {
      track(
        write.catch((error: unknown) => {
          warn(what, error);
        }),
      );
    },
    leave,
    view: async (id: number, waveformBars: number) => {
      flush?.();
      const opened = ++viewing;
      bars = waveformBars;
      opening(id, waveformBars);
      try {
        await show(opened, id, waveformBars);
      } catch (error: unknown) {
        warn(`${kind} not viewable`, error);
        if (live(opened)) failed();
      }
    },
    play: async (): Promise<AdvanceOutcome | null> => {
      const id = viewedId();
      if (id === null || starting) return null;
      starting = true;
      flush?.();
      const opened = viewing;
      const start = held();
      try {
        await Promise.all(writes);
        const outcome = await takeOver(id, bars, start);
        if (outcome !== ADVANCE_OUTCOME.playing) return outcome;
        await followSetlist(id);
        if (live(opened)) leave();
        return outcome;
      } finally {
        starting = false;
      }
    },
  };
}
