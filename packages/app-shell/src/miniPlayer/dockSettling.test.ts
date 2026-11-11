import { describe, expect, it, vi } from 'vitest';

import { followDockSettling, type DockNavigation } from './dockSettling.ts';

type Listener = (event: { readonly data: { closing: boolean } }) => void;

function fakeNavigation() {
  const listeners = new Map<string, Listener>();
  const removed = vi.fn();
  const navigation = {
    isFocused: () => true,
    addListener: (type: string, listener: Listener) => {
      listeners.set(type, listener);
      return removed;
    },
  } as unknown as DockNavigation;
  const emit = (type: string, closing = false) => {
    listeners.get(type)?.({ data: { closing } });
  };
  return { navigation, emit, removed };
}

describe('the dock under a pushed screen', () => {
  it('hides when another screen covers it', () => {
    const { navigation, emit } = fakeNavigation();
    const setSettled = vi.fn();
    followDockSettling(navigation, setSettled);
    emit('blur');
    expect(setSettled).toHaveBeenLastCalledWith(false);
  });

  it('stays hidden while the covering screen is still leaving', () => {
    const { navigation, emit } = fakeNavigation();
    const setSettled = vi.fn();
    followDockSettling(navigation, setSettled);
    emit('blur');
    emit('transitionEnd', true);
    expect(setSettled).toHaveBeenCalledTimes(1);
  });

  it('returns once its own screen has finished appearing', () => {
    const { navigation, emit } = fakeNavigation();
    const setSettled = vi.fn();
    followDockSettling(navigation, setSettled);
    emit('blur');
    emit('transitionEnd', false);
    expect(setSettled).toHaveBeenLastCalledWith(true);
  });

  it('stays hidden on focus alone, until its screen has finished appearing', () => {
    const { navigation, emit } = fakeNavigation();
    const setSettled = vi.fn();
    followDockSettling(navigation, setSettled);
    emit('blur');
    emit('focus');
    expect(setSettled).not.toHaveBeenCalledWith(true);
  });

  it('stops listening when the screen unmounts', () => {
    const { navigation, removed } = fakeNavigation();
    followDockSettling(navigation, vi.fn())();
    expect(removed).toHaveBeenCalledTimes(2);
  });
});
