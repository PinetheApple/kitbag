import type { AppStateStatus } from 'react-native';
import { expect, it, vi } from 'vitest';

const appState = vi.hoisted(() => {
  const handlers: ((state: AppStateStatus) => void)[] = [];
  return {
    handlers,
    addEventListener: vi.fn(
      (_event: string, handler: (state: AppStateStatus) => void) => {
        handlers.push(handler);
      },
    ),
  };
});
vi.mock('react-native', () => ({ AppState: appState }));

const { onAppForeground } = await import('./appForeground.ts');

it('calls the listener only when the app becomes active', () => {
  const listener = vi.fn();
  onAppForeground(listener);
  for (const state of ['background', 'inactive', 'active'] as const) {
    appState.handlers.forEach((handler) => {
      handler(state);
    });
  }
  expect(appState.addEventListener).toHaveBeenCalledWith(
    'change',
    expect.any(Function),
  );
  expect(listener).toHaveBeenCalledOnce();
});
