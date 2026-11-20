import { vi } from 'vitest';

import { ADVANCE_OUTCOME } from '../stemPlayer/songEnd.ts';
import type { AdvancingPlayer, AutoAdvanceDeps } from './autoAdvance.ts';

export function restingPlayer(): AdvancingPlayer {
  return {
    onSongEnd: vi.fn(() => () => undefined),
    onPrevious: vi.fn(() => () => undefined),
    playedSeconds: vi.fn(() => 0),
    restart: vi.fn(),
    takeOver: vi.fn(() => Promise.resolve(ADVANCE_OUTCOME.playing)),
    handOver: vi.fn(),
    stillEnded: vi.fn(() => true),
    stopAdvancing: vi.fn(),
    handToMetronome: vi.fn(),
  };
}

export const NO_BACK: Pick<AutoAdvanceDeps, 'backOf' | 'commitBack'> = {
  backOf: () => null,
  commitBack: () => Promise.resolve(),
};
