import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const rendered = vi.hoisted(() => [] as Props[]);

vi.mock('@kitbag/core-design', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  ToolRow: (props: Props) => {
    rendered.push(props);
    return null;
  },
}));

const { MoreToolsRow } = await import('./MoreToolsRow.tsx');

describe('MoreToolsRow', () => {
  beforeEach(() => {
    rendered.length = 0;
  });

  it('shows nothing when no tool is under More tools', () => {
    renderToStaticMarkup(
      createElement(MoreToolsRow, { count: 0, onPress: vi.fn() }),
    );
    expect(rendered).toEqual([]);
  });

  it('counts the tools and opens the sheet', () => {
    const onPress = vi.fn();
    renderToStaticMarkup(createElement(MoreToolsRow, { count: 2, onPress }));
    expect(rendered).toHaveLength(1);
    expect(rendered[0]?.title).toBe('More tools');
    expect(rendered[0]?.subtitle).toBe('2 tools');
    expect(rendered[0]?.onPress).toBe(onPress);
  });
});
