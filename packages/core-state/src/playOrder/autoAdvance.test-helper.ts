import { vi } from 'vitest';

import { ADVANCE_OUTCOME } from '../stemPlayer/songEnd.ts';
import type { AdvancingPlayer } from './autoAdvance.ts';

export function restingPlayer(): AdvancingPlayer {
  return {
    onSongEnd: vi.fn(() => () => undefined),
    takeOver: vi.fn(() => Promise.resolve(ADVANCE_OUTCOME.playing)),
    handOver: vi.fn(),
    stillEnded: vi.fn(() => true),
    stopAdvancing: vi.fn(),
    handToMetronome: vi.fn(),
  };
}
