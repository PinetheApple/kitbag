import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PerAccentSounds } from '../metronome/store.ts';
import { SOUND_ROLE, type SoundRole } from './soundChoice.ts';
import { useSoundPicker, type SoundsUpdate } from './useSoundPicker.ts';

const hooks = vi.hoisted(() => ({
  role: 'normal',
  held: [] as boolean[],
  previewSound: vi.fn(),
}));

vi.mock('react', () => ({
  useState: () => [hooks.role, vi.fn()],
  useCallback: <T,>(callback: T) => callback,
}));
vi.mock('../metronome/useHoldEngine.ts', () => ({
  useHoldEngine: (active: boolean) => {
    hooks.held.push(active);
  },
}));

const SOUNDS: PerAccentSounds = { normal: 1, accent: 4 };
const PICKED = 3;

function usePickedSounds(role: SoundRole) {
  hooks.role = role;
  const onChange = vi.fn<(update: SoundsUpdate) => void>();
  useSoundPicker(true, onChange, hooks.previewSound).pick(PICKED);
  const [update] = onChange.mock.calls[0] ?? [];
  return update?.(SOUNDS);
}

beforeEach(() => {
  hooks.held.length = 0;
  vi.clearAllMocks();
});

describe('useSoundPicker', () => {
  it('changes only the role being picked for', () => {
    expect(usePickedSounds(SOUND_ROLE.normal)).toEqual({ normal: PICKED, accent: 4 });
    expect(usePickedSounds(SOUND_ROLE.accent)).toEqual({ normal: 1, accent: PICKED });
  });

  it('previews the picked sound through the given preview, as its role', () => {
    usePickedSounds(SOUND_ROLE.accent);
    expect(hooks.previewSound).toHaveBeenCalledExactlyOnceWith(PICKED, true);
  });

  it('holds the engine only while the sheet is open', () => {
    useSoundPicker(false, vi.fn(), vi.fn());
    useSoundPicker(true, vi.fn(), vi.fn());
    expect(hooks.held).toEqual([false, true]);
  });
});
