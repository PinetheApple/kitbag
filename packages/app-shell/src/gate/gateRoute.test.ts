import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('expo-router', () => ({
  Unmatched: () => createElement('main', null, 'unmatched'),
}));

vi.mock('@/gate/GateScreen', () => ({
  GateScreen: () => createElement('main', null, 'gate'),
}));

const { default: GateRoute } = await import('@/app/gate.tsx');

function render(dev: boolean): string {
  vi.stubGlobal('__DEV__', dev);
  return renderToStaticMarkup(createElement(GateRoute));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('gate route', () => {
  it('renders the gate screen in a development build', () => {
    expect(render(true)).toBe('<main>gate</main>');
  });

  it('lands where an unknown route lands in a release build', () => {
    expect(render(false)).toBe('<main>unmatched</main>');
  });
});
