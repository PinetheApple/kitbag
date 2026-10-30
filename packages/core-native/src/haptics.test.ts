import { beforeEach, describe, expect, it, vi } from 'vitest';

const perform = vi.hoisted(() =>
  vi.fn<(effect: string) => Promise<void>>(() => Promise.resolve()),
);

vi.mock('expo-haptics', () => ({
  AndroidHaptics: { Confirm: 'confirm', Segment_Tick: 'segment-tick' },
  performAndroidHapticsAsync: perform,
}));
vi.mock('react-native', () => ({ Platform: { OS: 'android' } }));

const { confirmHaptic, setHapticsEnabled, tickHaptic } =
  await import('./haptics.ts');

describe('haptics setting', () => {
  beforeEach(() => {
    perform.mockClear();
    setHapticsEnabled(true);
  });

  it('plays both effects while haptics are on', () => {
    confirmHaptic();
    tickHaptic();
    expect(perform.mock.calls).toEqual([['confirm'], ['segment-tick']]);
  });

  it('plays neither effect while haptics are off', () => {
    setHapticsEnabled(false);
    confirmHaptic();
    tickHaptic();
    expect(perform).not.toHaveBeenCalled();
  });
});
