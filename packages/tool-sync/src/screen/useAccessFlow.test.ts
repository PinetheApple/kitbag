import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('react-native', () => ({
  AppState: { addEventListener: () => ({ remove: () => undefined }) },
}));

const sessions = vi.hoisted(() => ({
  state: {
    explainerDeclined: false,
    declineExplainer: () => undefined,
    openSettings: () => Promise.resolve(true),
  },
}));

vi.mock('@kitbag/core-state', () => ({
  getMediaSessionsStore: () => ({ getState: () => sessions.state }),
  useMediaSessions: <T>(selector: (state: typeof sessions.state) => T) =>
    selector(sessions.state),
}));

const { useAccessFlow } = await import('./useAccessFlow.ts');

function mount() {
  let flow: ReturnType<typeof useAccessFlow> | undefined;
  const Probe = () => {
    flow = useAccessFlow();
    return null;
  };
  renderToStaticMarkup(createElement(Probe));
  if (!flow) throw new Error('hook did not render');
  return flow;
}

beforeEach(() => {
  sessions.state = { ...sessions.state, explainerDeclined: false };
});

describe('useAccessFlow Not now', () => {
  it('is declined on a fresh mount once the store remembers it', () => {
    sessions.state = { ...sessions.state, explainerDeclined: true };
    expect(mount().declined).toBe(true);
  });

  it('is not declined on a fresh mount when never declined', () => {
    expect(mount().declined).toBe(false);
  });

  it('asks the store to remember Not now', () => {
    const declineExplainer = vi.fn();
    sessions.state = { ...sessions.state, declineExplainer };
    mount().notNow();
    expect(declineExplainer).toHaveBeenCalledOnce();
  });
});
