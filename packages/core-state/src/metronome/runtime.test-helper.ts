import { vi } from 'vitest';

import type { MetronomeCommands } from './commands.ts';
import { configureMetronomeRuntime } from './runtime.ts';

export function stubMetronomeRuntime(engineBpm: number): void {
  const commands = new Proxy(
    {},
    {
      get: (target: Record<string, unknown>, key: string) =>
        (target[key] ??= vi.fn()),
    },
  ) as unknown as MetronomeCommands;
  configureMetronomeRuntime({
    commands,
    nowFrame: () => 0,
    engineBpm: () => engineBpm,
  });
}
