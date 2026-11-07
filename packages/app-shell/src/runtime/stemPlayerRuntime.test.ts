import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  configureStemPlayer: vi.fn(),
  native: {
    mixerSetRate: vi.fn(() => Promise.resolve(0)),
    mixerRate: vi.fn(() => Promise.resolve(1)),
    mixerTrackPitch: vi.fn(() => Promise.resolve(2)),
  },
  setTrackKey: vi.fn(() => Promise.resolve(0)),
}));

vi.mock('@kitbag/core-native', () => ({
  getKitbagCommands: () => mocks.native,
  getKitbagHostObject: vi.fn(),
  getKitbagLibrary: vi.fn(),
  setTrackKey: mocks.setTrackKey,
}));
vi.mock('@kitbag/core-state', () => ({
  configureStemPlayer: mocks.configureStemPlayer,
}));
vi.mock('./database.ts', () => ({ getDatabase: vi.fn() }));
vi.mock('./notificationPermission.ts', () => ({
  askForNotificationsOnce: vi.fn(),
}));
vi.mock('./transportRuntime.ts', () => ({
  metronomeTransport: { active: vi.fn(), release: vi.fn() },
}));

await import('./stemPlayerRuntime.ts');

interface Commands {
  readonly mixerSetTrackPitch: (track: number, key: number) => Promise<number>;
  readonly mixerSetRate: (rate: number) => Promise<number>;
  readonly mixerRate: () => Promise<number>;
  readonly mixerTrackPitch: (track: number) => Promise<number>;
}
const [runtime] = mocks.configureStemPlayer.mock.lastCall as unknown as [
  { readonly commands: Commands },
];
const { commands } = runtime;

describe('stem player speed and key commands', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sends a stored key through the one rounding path', async () => {
    await commands.mixerSetTrackPitch(2, 1.5);
    expect(mocks.setTrackKey.mock.calls).toEqual([[mocks.native, 2, 1.5]]);
  });

  it('forwards speed and the settled reads to the module', async () => {
    await commands.mixerSetRate(0.75);
    expect(mocks.native.mixerSetRate.mock.calls).toEqual([[0.75]]);
    await expect(commands.mixerRate()).resolves.toBe(1);
    await expect(commands.mixerTrackPitch(4)).resolves.toBe(2);
    expect(mocks.native.mixerTrackPitch.mock.calls).toEqual([[4]]);
  });
});
