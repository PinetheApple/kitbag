import { KB_RESULT } from '@kitbag/core-native';

import {
  loopBetween,
  movedEdge,
  snapToBeat,
  type HeldStart,
  type LoopEdge,
  type LoopSeconds,
} from './loop.ts';
import type { MixerSessionContext } from './mixerSession.ts';
import { sessionGate } from './sessionGate.ts';
import type {
  ActionContext,
  LoopFailure,
  StemPlayerActions,
  StemPlayerState,
} from './store.ts';
import { framesToSeconds, secondsToFrames } from './time.ts';

export type LoopSlice = Pick<
  StemPlayerState,
  'beats' | 'engineRate' | 'durationFrames' | 'loop' | 'loopFailure'
>;

function boundsOf({ startSec, endSec }: LoopSeconds): LoopSeconds {
  return { startSec, endSec };
}

function loopHolds({ startSec, endSec }: LoopSeconds, seconds: number) {
  return seconds >= startSec && seconds < endSec;
}

function failureOf(result: number): LoopFailure {
  return result === KB_RESULT.KB_ERROR_INVALID_ARGUMENT ? 'pastEnd' : 'engine';
}

function loopControls(
  { set, get, runtimeOf, session }: MixerSessionContext<LoopSlice>,
  rememberUndo?: (bounds: LoopSeconds | null) => void,
) {
  const { busy, call } = sessionGate(session);
  const positionSeconds = () =>
    framesToSeconds(runtimeOf().engine.position(), get().engineRate);

  const refuse = (loopFailure: LoopFailure) => {
    const { loop } = get();
    set({ loop: loop.kind === 'on' ? loop : { kind: 'off' }, loopFailure });
  };

  const clear = async (undoable: LoopSeconds | null): Promise<boolean> => {
    const { result, live } = await call(() =>
      runtimeOf().commands.mixerClearLoop(),
    );
    if (!live) return false;
    if (result === KB_RESULT.KB_OK) {
      set({ loop: { kind: 'off' }, loopFailure: null });
      rememberUndo?.(undoable);
      return true;
    }
    set({ loopFailure: 'engine' });
    return false;
  };

  const setLoop = async (bounds: LoopSeconds): Promise<boolean> => {
    const { engineRate, durationFrames } = get();
    const startFrame = secondsToFrames(bounds.startSec, engineRate);
    const endFrame = Math.min(
      secondsToFrames(bounds.endSec, engineRate),
      durationFrames,
    );
    if (endFrame <= startFrame) {
      refuse('tooShort');
      return false;
    }
    const { commands } = runtimeOf();
    const { result, live } = await call(() =>
      commands.mixerSetLoop(startFrame, endFrame),
    );
    if (!live) {
      if (result === KB_RESULT.KB_OK)
        void commands.mixerClearLoop().catch(() => null);
      return false;
    }
    if (result === KB_RESULT.KB_OK) {
      set({
        loop: {
          kind: 'on',
          startSec: bounds.startSec,
          endSec: framesToSeconds(endFrame, engineRate),
        },
        loopFailure: null,
      });
      return true;
    }
    refuse(failureOf(result));
    return false;
  };

  const markLoop = async () => {
    if (busy()) return;
    const { loop, beats } = get();
    if (loop.kind === 'on') {
      await clear(null);
      return;
    }
    if (loop.kind === 'off') {
      set({
        loop: {
          kind: 'armed',
          startSec: snapToBeat(positionSeconds(), beats),
        },
        loopFailure: null,
      });
      rememberUndo?.(null);
      return;
    }
    const bounds = loopBetween(loop.startSec, positionSeconds(), beats);
    if (bounds === null) {
      refuse('tooShort');
      return;
    }
    await setLoop(bounds);
  };

  const moveLoopEdge = async (edge: LoopEdge, seconds: number) => {
    const { loop, beats, durationFrames, engineRate } = get();
    if (busy() || loop.kind !== 'on') return;
    const bounds = movedEdge(
      loop,
      edge,
      seconds,
      beats,
      framesToSeconds(durationFrames, engineRate),
    );
    if (bounds === null) {
      refuse('tooShort');
      return;
    }
    if (bounds.startSec === loop.startSec && bounds.endSec === loop.endSec)
      return;
    await setLoop(bounds);
  };

  return { busy, clear, setLoop, markLoop, moveLoopEdge };
}

type SetLoop = (bounds: LoopSeconds) => Promise<boolean>;

export async function applyHeldStart(
  { startSec, loop }: HeldStart,
  setLoop: SetLoop,
  get: () => Pick<StemPlayerActions, 'seek'> & Pick<LoopSlice, 'engineRate'>,
): Promise<void> {
  if (loop !== null) await setLoop(loop);
  get().seek(secondsToFrames(startSec, get().engineRate));
}

export function loopActions(context: MixerSessionContext<LoopSlice>): {
  readonly actions: Pick<StemPlayerActions, 'markLoop' | 'moveLoopEdge'>;
  readonly setLoop: SetLoop;
} {
  const { markLoop, moveLoopEdge, setLoop } = loopControls(context);
  return { actions: { markLoop, moveLoopEdge }, setLoop };
}

type SectionLoopActions = Pick<
  StemPlayerActions,
  | 'markLoop'
  | 'moveLoopEdge'
  | 'undoLoop'
  | 'dismissLoopUndo'
  | 'jumpToSection'
  | 'loopSection'
>;

export function sectionLoopActions(context: ActionContext): {
  readonly actions: SectionLoopActions;
  readonly setLoop: SetLoop;
} {
  const { set, get } = context;
  const { busy, clear, setLoop, markLoop, moveLoopEdge } = loopControls(
    context,
    (undoableLoop) => {
      set({ undoableLoop });
    },
  );
  const actions: SectionLoopActions = {
    markLoop,
    moveLoopEdge,
    undoLoop: async () => {
      const { undoableLoop } = get();
      if (busy() || undoableLoop === null) return;
      if (await setLoop(undoableLoop)) set({ undoableLoop: null });
    },
    dismissLoopUndo: () => {
      set({ undoableLoop: null });
    },
    jumpToSection: async (index) => {
      const { sections, loop } = get();
      const section = sections[index];
      if (busy() || section === undefined) return;
      if (
        loop.kind === 'on' &&
        !loopHolds(loop, section.startSec) &&
        !(await clear(boundsOf(loop)))
      )
        return;
      get().seek(secondsToFrames(section.startSec, get().engineRate));
    },
    loopSection: async (index) => {
      const { sections, loop, undoableLoop } = get();
      const section = sections[index];
      if (busy() || section === undefined) return;
      if (!(await setLoop(section))) return;
      set({ undoableLoop: loop.kind === 'on' ? boundsOf(loop) : undoableLoop });
      get().seek(secondsToFrames(section.startSec, get().engineRate));
    },
  };
  return { actions, setLoop };
}
