import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

const screen = vi.hoisted(() => ({ focused: true }));

vi.mock('expo-router', () => ({
  useNavigation: () => ({
    isFocused: () => screen.focused,
    addListener: () => () => undefined,
  }),
}));

const { useDockSettled } = await import('./useDockSettled.ts');

function settledOnMount(focused: boolean) {
  screen.focused = focused;
  let settled: boolean | undefined;
  const Probe = () => {
    settled = useDockSettled();
    return null;
  };
  renderToStaticMarkup(createElement(Probe));
  return settled;
}

describe('the dock on a screen that mounts', () => {
  it('shows on a focused screen', () => {
    expect(settledOnMount(true)).toBe(true);
  });

  it('stays hidden on a screen that mounts covered', () => {
    expect(settledOnMount(false)).toBe(false);
  });
});
