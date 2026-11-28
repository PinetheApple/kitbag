import {
  readBarPhase,
  readCurrentBeat,
  readCurrentBpm,
} from '@kitbag/core-native';
import type { ToolHost } from '@kitbag/core-plugin-api';
import { createToolStore } from '@kitbag/core-state';

export const toolHost: Omit<ToolHost, 'listening' | 'metronome'> = {
  engine: {
    reads: {
      barPhase: readBarPhase,
      currentBeat: readCurrentBeat,
      currentBpm: readCurrentBpm,
    },
  },
  store: { createToolStore },
};
