import { KB_RESULT } from '@kitbag/core-native';

import { loopBetween, snapToBeat, type LoopSeconds } from './loop.ts';
import { sessionGate } from './sessionGate.ts';
import type { ActionContext, LoopFailure, StemPlayerActions } from './store.ts';
import { framesToSeconds, secondsToFrames } from './time.ts';

function failureOf(result: number): LoopFailure {
  return result === KB_RESULT.KB_ERROR_INVALID_ARGUMENT ? 'pastEnd' : 'engine';
}

export function loopActions({
  set,
  get,
  runtimeOf,
  session,
}: ActionContext): Pick<StemPlayerActions, 'markLoop' | 'loopSection'> {
  const { busy, call } = sessionGate(session);
  const positionSeconds = () =>
    framesToSeconds(runtimeOf().engine.position(), get().engineRate);

  const clear = async () => {
    const { result, live } = await call(() =>
      runtimeOf().commands.mixerClearLoop(),
    );
    if (!live) return;
    if (result === KB_RESULT.KB_OK)
      set({ loop: { kind: 'off' }, loopFailure: null });
    else set({ loopFailure: 'engine' });
  };

  const setLoop = async (bounds: LoopSeconds): Promise<boolean> => {
    const { engineRate, durationFrames } = get();
    const startFrame = secondsToFrames(bounds.startSec, engineRate);
    const endFrame = Math.min(
      secondsToFrames(bounds.endSec, engineRate),
      durationFrames,
    );
    if (endFrame <= startFrame) {
      set({ loop: { kind: 'off' }, loopFailure: 'tooShort' });
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
    set({ loop: { kind: 'off' }, loopFailure: failureOf(result) });
    return false;
  };

  return {
    markLoop: async () => {
      if (busy()) return;
      const { loop, beats } = get();
      if (loop.kind === 'on') {
        await clear();
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
        return;
      }
      const bounds = loopBetween(loop.startSec, positionSeconds(), beats);
      if (bounds === null) {
        set({ loop: { kind: 'off' }, loopFailure: 'tooShort' });
        return;
      }
      await setLoop(bounds);
    },
    loopSection: async (index) => {
      const section = get().sections[index];
      if (busy() || section === undefined) return;
      if (await setLoop(section))
        get().seek(secondsToFrames(section.startSec, get().engineRate));
    },
  };
}
