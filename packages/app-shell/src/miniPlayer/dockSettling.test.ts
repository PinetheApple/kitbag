import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  followDockSettling,
  STACK_POP_MS,
  type DockNavigation,
} from './dockSettling.ts';

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

function followed() {
  const fake = fakeNavigation();
  const setSettled = vi.fn();
  const stop = followDockSettling(fake.navigation, setSettled);
  const settled = () => setSettled.mock.lastCall?.[0] as boolean | undefined;
  return { ...fake, setSettled, stop, settled };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe('the dock under a pushed screen', () => {
  it('hides when another screen covers it', () => {
    const { emit, settled } = followed();
    emit('blur');
    expect(settled()).toBe(false);
  });

  it('stays hidden while the covering screen is still leaving', () => {
    const { emit, setSettled } = followed();
    emit('blur');
    emit('transitionEnd', true);
    expect(setSettled).toHaveBeenCalledTimes(1);
  });

  it('returns once its own screen has finished appearing', () => {
    const { emit, settled } = followed();
    emit('blur');
    emit('transitionEnd', true);
    emit('focus');
    emit('transitionEnd', false);
    expect(settled()).toBe(true);
  });

  it('stays hidden on focus alone once covered, until its screen has finished appearing', () => {
    const { emit, setSettled } = followed();
    emit('blur');
    emit('transitionEnd', true);
    emit('focus');
    vi.advanceTimersByTime(STACK_POP_MS);
    expect(setSettled).not.toHaveBeenCalledWith(true);
  });

  it('ignores an appear that lands while it is covered', () => {
    const { emit, setSettled } = followed();
    emit('blur');
    emit('transitionEnd', false);
    expect(setSettled).not.toHaveBeenCalledWith(true);
  });

  it('stops listening when the screen unmounts', () => {
    const { stop, removed } = followed();
    stop();
    expect(removed).toHaveBeenCalledTimes(3);
  });
});

describe('the dock after a push cancelled before it covered the screen', () => {
  it('stays hidden while the cancelled screen is still leaving', () => {
    const { emit, settled } = followed();
    emit('blur');
    emit('focus');
    vi.advanceTimersByTime(STACK_POP_MS - 1);
    expect(settled()).toBe(false);
  });

  it('returns once the pop has had time to finish', () => {
    const { emit, settled } = followed();
    emit('blur');
    emit('focus');
    vi.advanceTimersByTime(STACK_POP_MS);
    expect(settled()).toBe(true);
  });

  it('returns at once if the screen reports it appeared', () => {
    const { emit, settled } = followed();
    emit('blur');
    emit('focus');
    emit('transitionEnd', false);
    expect(settled()).toBe(true);
  });

  it('stays hidden when another screen covers it before the pop finishes', () => {
    const { emit, setSettled } = followed();
    emit('blur');
    emit('focus');
    emit('blur');
    vi.advanceTimersByTime(STACK_POP_MS);
    expect(setSettled).not.toHaveBeenCalledWith(true);
  });

  it('stays shown when the screen is reported hidden late', () => {
    const { emit, settled } = followed();
    emit('blur');
    emit('focus');
    vi.advanceTimersByTime(STACK_POP_MS);
    emit('transitionEnd', true);
    expect(settled()).toBe(true);
  });

  it('does not return after the screen unmounts', () => {
    const { emit, stop, setSettled } = followed();
    emit('blur');
    emit('focus');
    stop();
    vi.advanceTimersByTime(STACK_POP_MS);
    expect(setSettled).not.toHaveBeenCalledWith(true);
  });

  it('waits for the appear on a completed push and pop that follows', () => {
    const { emit, settled } = followed();
    emit('blur');
    emit('focus');
    vi.advanceTimersByTime(STACK_POP_MS);
    emit('blur');
    emit('transitionEnd', true);
    emit('focus');
    vi.advanceTimersByTime(STACK_POP_MS);
    expect(settled()).toBe(false);
    emit('transitionEnd', false);
    expect(settled()).toBe(true);
  });

  it('falls back again when it follows a completed push and pop', () => {
    const { emit, settled } = followed();
    emit('blur');
    emit('transitionEnd', true);
    emit('focus');
    emit('transitionEnd', false);
    emit('blur');
    emit('focus');
    vi.advanceTimersByTime(STACK_POP_MS);
    expect(settled()).toBe(true);
  });
});
