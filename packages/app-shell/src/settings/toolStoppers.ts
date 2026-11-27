import type { getToolsStore } from '@kitbag/core-state';

import { TOOL_ID } from '../home/registry.ts';

export type ToolStoppers = Readonly<Record<string, () => void>>;

export interface ToolStopperDeps {
  readonly metronome: {
    readonly active: () => boolean;
    readonly release: () => void;
  };
  readonly stemPlayer: {
    readonly getState: () => {
      readonly setId: number | null;
      readonly close: () => void;
    };
  };
  readonly songPlayer: {
    readonly getState: () => {
      readonly songId: number | null;
      readonly close: () => void;
    };
  };
  readonly playAlong: {
    readonly getState: () => {
      readonly lock: object | undefined;
      readonly unlock: () => void;
      readonly stopClick: () => void;
    };
  };
}

export function toolStoppers({
  metronome,
  stemPlayer,
  songPlayer,
  playAlong,
}: ToolStopperDeps): ToolStoppers {
  return {
    [TOOL_ID.metronome]: () => {
      if (metronome.active()) metronome.release();
    },
    [TOOL_ID.stems]: () => {
      const player = stemPlayer.getState();
      if (player.setId !== null) player.close();
    },
    [TOOL_ID.library]: () => {
      const player = songPlayer.getState();
      if (player.songId !== null) player.close();
    },
    [TOOL_ID.sync]: () => {
      const follower = playAlong.getState();
      if (follower.lock !== undefined) follower.unlock();
      follower.stopClick();
    },
  };
}

export function stopWhenSwitchedOff(
  store: ReturnType<typeof getToolsStore>,
  stoppers: ToolStoppers,
): () => void {
  return store.subscribe((state, previous) => {
    for (const toolId of state.off) {
      if (!previous.off.includes(toolId)) stoppers[toolId]?.();
    }
  });
}
