import { KB_RESULT } from '@kitbag/core-native';

import { usableDownbeats } from './bars.ts';
import { clickGrid } from './loop.ts';
import type { MixerSessionContext } from './mixerSession.ts';
import type { PendingClick } from './pendingClick.ts';
import type { MixerRuntime } from './runtime.ts';
import { sessionGate } from './sessionGate.ts';
import type { StemPlayerActions, StemPlayerState } from './store.ts';

const GRID_ANCHOR_FRAME = 0;

export type ClickSlice = Pick<
  StemPlayerState,
  'status' | 'beats' | 'downbeatIndices' | 'click'
>;

export interface ClickHandoff {
  readonly recountWithClickOff: () => boolean;
  readonly recountWithClickOn: () => boolean;
}

type ClickContext = Pick<
  MixerSessionContext<ClickSlice>,
  'set' | 'get' | 'runtimeOf'
>;

const noCount = () => false;

function releaseGrid({ commands }: Pick<MixerRuntime, 'commands'>): void {
  commands.metronomeFollowMixer(false);
  commands.clearGrid();
}

export function stopClick(runtime: Pick<MixerRuntime, 'commands'>): void {
  releaseGrid(runtime);
  runtime.commands.metronomeStop();
}

export function releaseClick({ set, get, runtimeOf }: ClickContext): boolean {
  if (!get().click) return false;
  set({ click: false });
  releaseGrid(runtimeOf());
  return true;
}

export function turnClickOff(
  context: ClickContext,
  recountWithClickOff: () => boolean = noCount,
): void {
  if (!context.get().click) return;
  const recounted = recountWithClickOff();
  releaseClick(context);
  if (!recounted) context.runtimeOf().commands.metronomeStop();
}

export function clickActions(
  { set, get, runtimeOf, session }: MixerSessionContext<ClickSlice>,
  pendingClick: PendingClick,
  {
    recountWithClickOff = noCount,
    recountWithClickOn = noCount,
  }: Partial<ClickHandoff> = {},
): Pick<StemPlayerActions, 'toggleClick'> {
  const { busy, call } = sessionGate(session);

  const start = async () => {
    const { commands, engine, sharedMetronome } = runtimeOf();
    const grid = clickGrid(get().beats);
    if (grid.length === 0) return;
    const downbeats = usableDownbeats(get().downbeatIndices, grid.length);
    if (sharedMetronome.active()) sharedMetronome.release();
    const turnOn = pendingClick.begin();
    const { result, live } = await call(() =>
      commands.setGrid(grid, downbeats, GRID_ANCHOR_FRAME),
    );
    const current = pendingClick.finish(turnOn);
    if (result !== KB_RESULT.KB_OK) return;
    if (!current || !live || get().status !== 'ready') {
      commands.clearGrid();
      return;
    }
    commands.metronomeFollowMixer(true);
    const recounted = recountWithClickOn();
    if (!recounted) commands.metronomeStart(engine.nowFrame());
    set({ click: true });
  };

  return {
    toggleClick: async () => {
      if (busy()) return;
      if (get().click) {
        turnClickOff({ set, get, runtimeOf }, recountWithClickOff);
        return;
      }
      await start();
    },
  };
}
