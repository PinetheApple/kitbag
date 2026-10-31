import { KB_RESULT } from '@kitbag/core-native';

import { clickGrid } from './loop.ts';
import type { StemPlayerRuntime } from './runtime.ts';
import { sessionGate } from './sessionGate.ts';
import type { ActionContext, StemPlayerActions } from './store.ts';

const GRID_ANCHOR_FRAME = 0;

export function stopClick({ commands }: StemPlayerRuntime): void {
  commands.metronomeFollowMixer(false);
  commands.clearGrid();
  commands.metronomeStop();
}

export function turnClickOff({
  set,
  get,
  runtimeOf,
}: Pick<ActionContext, 'set' | 'get' | 'runtimeOf'>): void {
  if (!get().click) return;
  set({ click: false });
  stopClick(runtimeOf());
}

export function clickActions({
  set,
  get,
  runtimeOf,
  session,
}: ActionContext): Pick<StemPlayerActions, 'toggleClick'> {
  const { busy, call } = sessionGate(session);

  const start = async () => {
    const { commands, engine, sharedMetronome } = runtimeOf();
    const grid = clickGrid(get().beats);
    if (grid.length === 0) return;
    if (sharedMetronome.active()) sharedMetronome.release();
    const { result, live } = await call(() =>
      commands.setGrid(grid, GRID_ANCHOR_FRAME),
    );
    if (result !== KB_RESULT.KB_OK) return;
    if (!live || get().status !== 'ready') {
      commands.clearGrid();
      return;
    }
    commands.metronomeFollowMixer(true);
    commands.metronomeStart(engine.nowFrame());
    set({ click: true });
  };

  return {
    toggleClick: async () => {
      if (busy()) return;
      if (get().click) {
        turnClickOff({ set, get, runtimeOf });
        return;
      }
      await start();
    },
  };
}
