import { KB_RESULT } from '@kitbag/core-native';

import { loopBetween, snapToBeat, type LoopSeconds } from './loop.ts';
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
      if (result === KB_RESULT.KB_OK) void commands.mixerClearLoop();
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

  return { busy, clear, setLoop, markLoop };
}

export function loopActions(
  context: MixerSessionContext<LoopSlice>,
): Pick<StemPlayerActions, 'markLoop'> {
  return { markLoop: loopControls(context).markLoop };
}

export function sectionLoopActions(
  context: ActionContext,
): Pick<
  StemPlayerActions,
  'markLoop' | 'undoLoop' | 'dismissLoopUndo' | 'jumpToSection' | 'loopSection'
> {
  const { set, get } = context;
  const { busy, clear, setLoop, markLoop } = loopControls(
    context,
    (undoableLoop) => {
      set({ undoableLoop });
    },
  );
  return {
    markLoop,
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
}
