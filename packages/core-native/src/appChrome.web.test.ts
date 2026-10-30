import { describe, expect, it, vi } from 'vitest';

vi.mock('./NativeKitbagCommands', () => ({
  getKitbagCommands: () => {
    throw new Error('no native module on web');
  },
}));

const {
  WEB_APP_VERSION,
  getAppVersion,
  setAppNightMode,
  setSystemBarAppearance,
} = await import('./appChrome.web.ts');

describe('appChrome (web)', () => {
  it('reports a version marked as web', () => {
    expect(getAppVersion()).toBe(WEB_APP_VERSION);
    expect(WEB_APP_VERSION.versionName).toMatch(/web/i);
  });

  it('never reaches the native module', () => {
    expect(() => {
      setAppNightMode('dark');
      setSystemBarAppearance(true);
    }).not.toThrow();
  });
});
