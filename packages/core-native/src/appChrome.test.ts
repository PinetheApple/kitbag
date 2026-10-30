import { beforeEach, describe, expect, it, vi } from 'vitest';

import { APP_NIGHT_MODES, type AppNightMode } from './appNightMode.ts';
import type { KitbagCommandsConstants } from './NativeKitbagCommands';

const constants: KitbagCommandsConstants = {
  versionName: '1.4.2',
  versionCode: 4_000_000_042,
  nightModeSystem: 'native-system',
  nightModeDark: 'native-dark',
  nightModeLight: 'native-light',
};

const wireByMode: readonly (readonly [AppNightMode, string])[] = [
  ['system', 'native-system'],
  ['dark', 'native-dark'],
  ['light', 'native-light'],
];

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

  it.each(wireByMode)(
    'sends %s as the string the native side owns',
    (mode, wire) => {
      setAppNightMode(mode);
      expect(commands.setAppNightMode).toHaveBeenCalledExactlyOnceWith(wire);
    },
  );

  it('covers every declared mode', () => {
    expect(wireByMode.map(([mode]) => mode)).toEqual([...APP_NIGHT_MODES]);
  });

  it.each([true, false])('forwards light=%s to the system bars', (light) => {
    setSystemBarAppearance(light);
    expect(commands.setSystemBarAppearance).toHaveBeenCalledExactlyOnceWith(
      light,
    );
  });
});
