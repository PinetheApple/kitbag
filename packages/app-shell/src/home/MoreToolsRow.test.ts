import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const rendered = vi.hoisted(() => [] as Props[]);
const push = vi.hoisted(() => vi.fn<(href: string) => void>());

vi.mock('expo-router', () => ({ useRouter: () => ({ push }) }));

vi.mock('@kitbag/core-design', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  ToolRow: (props: Props) => {
    rendered.push(props);
    return null;
  },
}));

const { MoreToolsRow } = await import('./MoreToolsRow.tsx');
const { MORE_TOOLS_SUBTEXT } = await import('./subtext.ts');

describe('MoreToolsRow', () => {
  it('opens Settings → Tools', () => {
    renderToStaticMarkup(createElement(MoreToolsRow));
    const row = rendered[0];
    expect(row?.status).toBe('ready');
    expect(row?.subtitle).toBe(MORE_TOOLS_SUBTEXT);
    (row?.onPress as () => void)();
    expect(push).toHaveBeenCalledWith('/settings/tools');
  });
});
