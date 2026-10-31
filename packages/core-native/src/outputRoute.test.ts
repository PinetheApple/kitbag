import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { OutputRoute } from './outputRouteTypes.ts';

const speaker: OutputRoute = {
  id: 'speaker',
  name: 'Speaker',
  kind: 'speaker',
  certain: true,
};
const headset: OutputRoute = {
  id: 'bt-a2dp:EE:FF:Buds',
  name: 'Buds',
  kind: 'bluetooth',
  certain: true,
};

const native = vi.hoisted(() => {
  const state = {
    listener: undefined as ((route: unknown) => void) | undefined,
    resolveGet: undefined as ((route: unknown) => void) | undefined,
  };
  const remove = vi.fn();
  return {
    state,
    remove,
    commands: {
      getOutputRoute: vi.fn(
        () =>
          new Promise((resolve) => {
            state.resolveGet = resolve;
          }),
      ),
      onOutputRoute: vi.fn((listener: (route: unknown) => void) => {
        state.listener = listener;
        return { remove };
      }),
    },
  };
});

vi.mock('./NativeKitbagCommands', () => ({
  getKitbagCommands: () => native.commands,
}));

const { getOutputRoute, watchOutputRoute } = await import('./outputRoute.ts');

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('watchOutputRoute', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('delivers the current route when no change event arrives first', async () => {
    const seen = vi.fn();
    watchOutputRoute(seen);
    native.state.resolveGet?.(speaker);
    await settle();
    expect(seen.mock.calls).toEqual([[speaker]]);
  });

  it('keeps a change event that arrives before the current route resolves', async () => {
    const seen = vi.fn();
    watchOutputRoute(seen);
    native.state.listener?.(headset);
    native.state.resolveGet?.(speaker);
    await settle();
    expect(seen.mock.calls).toEqual([[headset]]);
  });

  it('subscribes before it asks for the current route', () => {
    watchOutputRoute(vi.fn());
    const subscribed =
      native.commands.onOutputRoute.mock.invocationCallOrder[0];
    const asked = native.commands.getOutputRoute.mock.invocationCallOrder[0];
    expect(subscribed).toBeLessThan(asked ?? 0);
  });

  it('removes the native subscription and ignores a late result on unsubscribe', async () => {
    const seen = vi.fn();
    const unsubscribe = watchOutputRoute(seen);
    unsubscribe();
    native.state.resolveGet?.(speaker);
    await settle();
    expect(native.remove).toHaveBeenCalledOnce();
    expect(seen).not.toHaveBeenCalled();
  });
});

describe('getOutputRoute', () => {
  it('resolves what native reports', async () => {
    const route = getOutputRoute();
    native.state.resolveGet?.(headset);
    await expect(route).resolves.toEqual(headset);
  });
});
