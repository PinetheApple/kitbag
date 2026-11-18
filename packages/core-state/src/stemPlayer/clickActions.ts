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

function gridOf({ beats, downbeatIndices }: ClickSlice) {
  const grid = clickGrid(beats);
  return { grid, downbeats: usableDownbeats(downbeatIndices, grid.length) };
}

export async function followNewGrid({
  set,
  get,
  runtimeOf,
  session,
}: MixerSessionContext<ClickSlice>): Promise<void> {
  if (!get().click) return;
  const sent = get().beats;
  const { grid, downbeats } = gridOf(get());
  if (grid.length === 0) {
    turnClickOff({ set, get, runtimeOf });
    return;
  }
  const opened = session();
  const result = await runtimeOf()
    .commands.setGrid(grid, downbeats, GRID_ANCHOR_FRAME)
    .catch(() => KB_RESULT.KB_ERROR_INTERNAL);
  if (opened !== session() || get().beats !== sent) return;
  if (result !== KB_RESULT.KB_OK) turnClickOff({ set, get, runtimeOf });
}

export function clickActions(
  context: MixerSessionContext<ClickSlice>,
  pendingClick: PendingClick,
  {
    recountWithClickOff = noCount,
    recountWithClickOn = noCount,
  }: Partial<ClickHandoff> = {},
): Pick<StemPlayerActions, 'toggleClick'> {
  const { set, get, runtimeOf, session } = context;
  const { busy, call } = sessionGate(session);

  const start = async () => {
    const { commands, engine, sharedMetronome } = runtimeOf();
    const sent = get().beats;
    const { grid, downbeats } = gridOf(get());
    if (grid.length === 0) return;
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
    if (get().beats !== sent) await followNewGrid(context);
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
