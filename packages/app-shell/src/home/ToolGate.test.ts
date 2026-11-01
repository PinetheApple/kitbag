import type { ToolsStore } from '@kitbag/core-state';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { TOOL_ID } from './registry.ts';

const dismissTo = vi.hoisted(() => vi.fn<(href: string) => void>());
const tools = vi.hoisted(() => ({ off: [] as readonly string[] }));

vi.mock('@kitbag/core-state', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useTools: <T>(selector: (state: ToolsStore) => T) =>
    selector({ off: tools.off, setOff: () => undefined }),
}));

vi.mock('expo-router', () => ({
  useRouter: () => ({ dismissTo }),
  useFocusEffect: (effect: () => void) => {
    effect();
  },
}));

const { ToolGate } = await import('./ToolGate.tsx');

function render(toolId: string): string {
  return renderToStaticMarkup(
    createElement(ToolGate, { toolId }, createElement('main', null, 'tool')),
  );
}

beforeEach(() => {
  dismissTo.mockClear();
  tools.off = [];
});

describe('ToolGate', () => {
  it('opens a tool that is on', () => {
    expect(render(TOOL_ID.tuner)).toContain('tool');
    expect(dismissTo).not.toHaveBeenCalled();
  });

  it('sends a route to an off tool back to Home without rendering it', () => {
    tools.off = [TOOL_ID.tuner];
    expect(render(TOOL_ID.tuner)).toBe('');
    expect(dismissTo).toHaveBeenCalledWith('/');
  });
});
