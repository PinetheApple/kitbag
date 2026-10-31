import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { AppNightMode } from './appChromeTypes.ts';
import type { KitbagCommandsConstants } from './NativeKitbagCommands';

const constants: KitbagCommandsConstants = {
  versionName: '1.4.2',
  versionCode: 4_000_000_042,
};

const commands = vi.hoisted(() => ({
  getConstants: vi.fn(),
  setAppNightMode: vi.fn(),
  setSystemBarAppearance: vi.fn(),
}));

vi.mock('./NativeKitbagCommands', () => ({
  getKitbagCommands: () => commands,
}));

const { getAppVersion, setAppNightMode, setSystemBarAppearance } =
  await import('./appChrome.ts');

describe('appChrome (native)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    commands.getConstants.mockReturnValue(constants);
  });

  it('reports the installed package version, not a JS copy', () => {
    expect(getAppVersion()).toEqual({
      versionName: '1.4.2',
      versionCode: 4_000_000_042,
    });
  });

  it.each<AppNightMode>(['system', 'dark', 'light'])(
    'sends %s to native unchanged',
    (mode) => {
      setAppNightMode(mode);
      expect(commands.setAppNightMode).toHaveBeenCalledExactlyOnceWith(mode);
    },
  );

  it.each([true, false])('forwards light=%s to the system bars', (light) => {
    setSystemBarAppearance(light);
    expect(commands.setSystemBarAppearance).toHaveBeenCalledExactlyOnceWith(
      light,
    );
  });
});
