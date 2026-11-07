import { KB_RESULT } from '@kitbag/core-native';

import { usableDownbeats } from './bars.ts';
import { clickGrid } from './loop.ts';
import type { MixerSessionContext } from './mixerSession.ts';
import type { MixerRuntime } from './runtime.ts';
import { sessionGate } from './sessionGate.ts';
import type { StemPlayerActions, StemPlayerState } from './store.ts';

const GRID_ANCHOR_FRAME = 0;

export type ClickSlice = Pick<
  StemPlayerState,
  'status' | 'beats' | 'downbeatIndices' | 'click'
>;

export function stopClick({ commands }: Pick<MixerRuntime, 'commands'>): void {
  commands.metronomeFollowMixer(false);
  commands.clearGrid();
  commands.metronomeStop();
}

export function turnClickOff({
  set,
  get,
  runtimeOf,
}: Pick<MixerSessionContext<ClickSlice>, 'set' | 'get' | 'runtimeOf'>): void {
  if (!get().click) return;
  set({ click: false });
  stopClick(runtimeOf());
}

export function clickActions({
  set,
  get,
  runtimeOf,
  session,
}: MixerSessionContext<ClickSlice>): Pick<StemPlayerActions, 'toggleClick'> {
  const { busy, call } = sessionGate(session);

  const start = async () => {
    const { commands, engine, sharedMetronome } = runtimeOf();
    const grid = clickGrid(get().beats);
    if (grid.length === 0) return;
    const downbeats = usableDownbeats(get().downbeatIndices, grid.length);
    if (sharedMetronome.active()) sharedMetronome.release();
    const { result, live } = await call(() =>
      commands.setGrid(grid, downbeats, GRID_ANCHOR_FRAME),
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
