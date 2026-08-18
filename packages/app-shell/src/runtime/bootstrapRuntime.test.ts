// Pins the failure path of the app-wide install: RootLayout mounts once and
// never unmounts, so a swallowed throw would hide a frozen §13.3 sweep forever.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getKitbagCommands = vi.fn();

vi.mock('@kitbag/core-native', () => ({
  getKitbagCommands,
  getKitbagHostObject: vi.fn(),
  KITBAG_HOST_OBJECT_KEY: '__KitbagHostObject',
}));

vi.mock('react-native-worklets', () => ({
  runOnUISync: (fn: () => void) => {
    fn();
  },
}));

// Stands in for a mount: useEffect's callback runs synchronously, which is all
// this hook does. Avoids pulling a renderer in for a no-render hook.
vi.mock('react', () => ({
  useEffect: (effect: () => void) => {
    effect();
  },
}));

describe('useKitbagRuntime', () => {
  beforeEach(() => {
    vi.resetModules();
    getKitbagCommands.mockReset();
    getKitbagCommands.mockImplementation(() => {
      throw new Error('native module not registered');
    });
  });

  it('does not rethrow when the native module is missing', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { useKitbagRuntime } = await import('./bootstrapRuntime');

    expect(() => {
      useKitbagRuntime();
    }).not.toThrow();
    expect(warn).toHaveBeenCalledTimes(1);

    warn.mockRestore();
  });

  it('reports the failure instead of failing silently', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { useKitbagRuntime } = await import('./bootstrapRuntime');

    useKitbagRuntime();

    expect(warn.mock.calls[0]?.[0]).toContain('runtime install failed');

    warn.mockRestore();
  });

  it('attempts the install only once per process', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const { bootstrapKitbagRuntime, useKitbagRuntime } =
      await import('./bootstrapRuntime');

    getKitbagCommands.mockReset();
    getKitbagCommands.mockReturnValue({});

    bootstrapKitbagRuntime();
    useKitbagRuntime();
    bootstrapKitbagRuntime();

    expect(getKitbagCommands).toHaveBeenCalledTimes(1);
    expect(warn).not.toHaveBeenCalled();

    warn.mockRestore();
  });
});
