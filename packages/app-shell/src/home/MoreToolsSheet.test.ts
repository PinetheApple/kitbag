import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
  hasHomeTile,
  HOME_TOOLS,
  TOOL_ID,
  type BuiltTool,
} from './registry.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const recorded = vi.hoisted(() => ({
  sheets: [] as Props[],
  rows: [] as Props[],
  hints: [] as ReactNode[],
}));

vi.mock('@kitbag/core-design', async (original) => {
  const { createElement: create } = await import('react');
  return {
    ...(await original<Record<string, unknown>>()),
    Sheet: (props: Props) => {
      recorded.sheets.push(props);
      return create('div', null, props.children);
    },
    SheetHint: (props: Props) => {
      recorded.hints.push(props.children);
      return null;
    },
    ToolRow: (props: Props) => {
      recorded.rows.push(props);
      return null;
    },
  };
});

const { MoreToolsSheet } = await import('./MoreToolsSheet.tsx');

function tool(id: string): BuiltTool {
  const found = HOME_TOOLS.find((t) => t.id === id);
  if (found === undefined || !hasHomeTile(found)) throw new Error(id);
  return found;
}

const tap = (index: number) => {
  (recorded.rows[index]?.onPress as () => void)();
};

const closed = () => {
  (recorded.sheets[0]?.onClosed as () => void)();
};

describe('MoreToolsSheet', () => {
  const openStems = vi.fn();
  const openPractice = vi.fn();
  const onDismiss = vi.fn();

  beforeEach(() => {
    recorded.sheets.length = 0;
    recorded.rows.length = 0;
    recorded.hints.length = 0;
    vi.clearAllMocks();
    renderToStaticMarkup(
      createElement(MoreToolsSheet, {
        visible: true,
        bottomInset: 0,
        onDismiss,
        items: [
          {
            tool: tool(TOOL_ID.stems),
            subtitle: '6 stem songs',
            onPress: openStems,
          },
          {
            tool: tool(TOOL_ID.practiceHistory),
            subtitle: 'Yesterday · 42:10',
            onPress: openPractice,
          },
        ],
      }),
    );
  });

  it('is titled More tools and points to Edit for Home tiles', () => {
    expect(recorded.sheets[0]?.title).toBe('More tools');
    expect(recorded.hints).toEqual([
      'To make one a Home tile, tap Edit on Home.',
    ]);
  });

  it('lists each tool with its tile subtext', () => {
    expect(
      recorded.rows.map((row) => [row.title, row.subtitle, row.status]),
    ).toEqual([
      ['Stem songs', '6 stem songs', 'ready'],
      ['Practice history', 'Yesterday · 42:10', 'ready'],
    ]);
  });

  it('closes the sheet and opens the tapped tool only once it has closed', () => {
    tap(1);
    expect(onDismiss).toHaveBeenCalledTimes(1);
    expect(openPractice).not.toHaveBeenCalled();
    closed();
    expect(openPractice).toHaveBeenCalledTimes(1);
    expect(openStems).not.toHaveBeenCalled();
  });

  it('opens one tool when a row is tapped twice while the sheet leaves', () => {
    tap(1);
    tap(1);
    closed();
    expect(openPractice).toHaveBeenCalledTimes(1);
  });
});
