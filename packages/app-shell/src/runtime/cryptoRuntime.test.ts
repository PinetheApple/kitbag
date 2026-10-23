import { afterEach, describe, expect, it, vi } from 'vitest';

const UUID = '7b3c1e9a-2f4d-4c8e-9a1b-5d6e7f8a9b0c';

vi.mock('expo-crypto', () => ({ randomUUID: () => UUID }));

describe('cryptoRuntime', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it('gives a runtime without Web Crypto a randomUUID', async () => {
    vi.stubGlobal('crypto', undefined);
    await import('./cryptoRuntime');
    expect(globalThis.crypto.randomUUID()).toBe(UUID);
  });

  it('leaves a native randomUUID alone', async () => {
    const native = { randomUUID: () => 'native' };
    vi.stubGlobal('crypto', native);
    await import('./cryptoRuntime');
    expect(globalThis.crypto.randomUUID()).toBe('native');
  });
});
