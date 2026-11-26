import { MS_PER_SECOND } from '@kitbag/core-db';
import { KB_RESULT } from '@kitbag/core-native';

import type { DetectedGrid } from '../stemPlayer/meterOverride.ts';
import type { PlayAlongCommands } from './runtime.ts';

const GRID_ANCHOR_FRAME = 0;

type GridCommands = Pick<
  PlayAlongCommands,
  'setGrid' | 'clearGrid' | 'metronomeAnchorGrid'
>;

export interface GridReply {
  readonly accepted: () => void;
  readonly rejected: () => void;
}

export function engineGrid(commands: GridCommands) {
  let sent: DetectedGrid | undefined;
  let ready = false;
  let generation = 0;
  return {
    holds: (grid: DetectedGrid) => sent === grid,
    send: (grid: DetectedGrid, reply: GridReply) => {
      const mine = ++generation;
      sent = grid;
      ready = false;
      const settle = (result: number) => {
        if (mine !== generation) return;
        if (result !== KB_RESULT.KB_OK) {
          reply.rejected();
          return;
        }
        ready = true;
        reply.accepted();
      };
      void commands
        .setGrid(grid.beats, grid.downbeatIndices, GRID_ANCHOR_FRAME)
        .then(settle, () => {
          settle(KB_RESULT.KB_ERROR_INTERNAL);
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
