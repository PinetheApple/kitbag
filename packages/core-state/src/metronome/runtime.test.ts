import { describe, expect, it, vi } from 'vitest';

import { configureMetronomeRuntime, type MetronomeRuntime } from './runtime.ts';

const commands = {
  start: vi.fn(() => 1),
} as unknown as MetronomeRuntime['commands'];
const runtime: MetronomeRuntime = {
  commands,
  nowFrame: () => 42,
};

describe('metronome runtime', () => {
  it('configures once and rejects a different runtime', () => {
    configureMetronomeRuntime(runtime);
    expect(() => {
      configureMetronomeRuntime(runtime);
    }).not.toThrow();
    expect(() => {
      configureMetronomeRuntime({ commands, nowFrame: () => 43 });
    }).toThrow('already configured');
  });
});
