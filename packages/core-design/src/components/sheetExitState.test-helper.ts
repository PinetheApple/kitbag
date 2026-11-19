import { vi } from 'vitest';

export const REDUCED = 'always';
export const FULL = 'never';

export const anim = {
  running: new Set<(finished: boolean) => void>(),
  exits: [] as ((finished: boolean) => void)[],
  motion: FULL as string,
};
export const focusReaderOn = vi.fn();
export const keyboard = { height: { value: 0 } };
export const frames: (() => void)[] = [];
export const dismissKeyboard = vi.fn();
