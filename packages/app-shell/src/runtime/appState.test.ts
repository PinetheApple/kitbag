import type { AppStateStatus } from 'react-native';
import { beforeEach, expect, it, vi } from 'vitest';

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

const { onAppBackground, onAppForeground } = await import('./appState.ts');

function moveApp(state: AppStateStatus) {
  appState.handlers.forEach((handler) => {
    handler(state);
  });
}

beforeEach(() => {
  appState.handlers.length = 0;
});

it('calls the listener only when the app becomes active', () => {
  const listener = vi.fn();
  onAppForeground(listener);
  for (const state of ['background', 'inactive', 'active'] as const) {
    moveApp(state);
  }
  expect(appState.addEventListener).toHaveBeenCalledWith(
    'change',
    expect.any(Function),
  );
  expect(listener).toHaveBeenCalledOnce();
});

it('calls the listener only when the app goes to the background', () => {
  const listener = vi.fn();
  onAppBackground(listener);
  moveApp('active');
  moveApp('inactive');
  expect(listener).not.toHaveBeenCalled();

  moveApp('background');

  expect(listener).toHaveBeenCalledOnce();
});
