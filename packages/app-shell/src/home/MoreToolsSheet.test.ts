import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { HOME_TOOLS, TOOL_ID, type HomeToolEntry } from './registry.ts';

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

function tool(id: string): HomeToolEntry {
  const found = HOME_TOOLS.find((t) => t.id === id);
  if (found === undefined) throw new Error(id);
  return found;
}

describe('MoreToolsSheet', () => {
  const openStems = vi.fn();
  const openPractice = vi.fn();
  const onDismiss = vi.fn();
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

  it('opens only the tapped tool and closes the sheet', () => {
    (recorded.rows[1]?.onPress as () => void)();
    expect(openPractice).toHaveBeenCalledTimes(1);
    expect(openStems).not.toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
