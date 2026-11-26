import { MS_PER_SECOND } from '@kitbag/core-db';
import { KB_RESULT } from '@kitbag/core-native';

import type { DetectedGrid } from '../stemPlayer/meterOverride.ts';
import type { PlayAlongCommands } from './runtime.ts';

const GRID_ANCHOR_FRAME = 0;
const DOWNBEAT_ATTEMPTS = 2;

type GridCommands = Pick<
  PlayAlongCommands,
  'setGrid' | 'clearGrid' | 'metronomeAnchorGrid' | 'metronomeSetGridDownbeats'
>;

export interface GridReply {
  readonly accepted: () => void;
  readonly rejected: () => void;
}

const settled = (
  promise: Promise<number>,
  onResult: (result: number) => void,
) => {
  void promise.then(onResult, () => {
    onResult(KB_RESULT.KB_ERROR_INTERNAL);
  });
};

export function engineGrid(commands: GridCommands) {
  let sent: DetectedGrid | undefined;
  let ready = false;
  let generation = 0;
  let heldDownbeats: readonly number[] | undefined;
  let askedDownbeats: readonly number[] | undefined;
  let refusedDownbeats: readonly number[] | undefined;
  let refusals = 0;
  let asks = 0;
  return {
    holds: (grid: DetectedGrid) => sent === grid,
    send: (grid: DetectedGrid, reply: GridReply) => {
      const mine = ++generation;
      sent = grid;
      ready = false;
      heldDownbeats = grid.downbeatIndices;
      askedDownbeats = undefined;
      settled(
        commands.setGrid(grid.beats, grid.downbeatIndices, GRID_ANCHOR_FRAME),
        (result) => {
          if (mine !== generation) return;
          if (result !== KB_RESULT.KB_OK) {
            reply.rejected();
            return;
          }
          ready = true;
          reply.accepted();
        },
      );
    },
    placeDownbeats: (downbeats: readonly number[], reply: GridReply) => {
      if (!ready || downbeats === (askedDownbeats ?? heldDownbeats)) return;
      if (downbeats !== refusedDownbeats) refusals = 0;
      const mine = generation;
      const ask = ++asks;
      askedDownbeats = downbeats;
      settled(commands.metronomeSetGridDownbeats(downbeats), (result) => {
        if (mine !== generation || ask !== asks) return;
        askedDownbeats = undefined;
        if (result === KB_RESULT.KB_OK) {
          heldDownbeats = downbeats;
          reply.accepted();
          return;
        }
        refusedDownbeats = downbeats;
        if (++refusals >= DOWNBEAT_ATTEMPTS) reply.rejected();
      });
    },
    anchor: (songMs: number, frame: number, rate: number): boolean => {
      if (!ready) return false;
      commands.metronomeAnchorGrid(songMs / MS_PER_SECOND, frame, rate);
      return true;
    },
    drop: () => {
      if (sent === undefined) return;
      generation++;
      sent = undefined;
      ready = false;
      commands.clearGrid();
    },
  };
}
