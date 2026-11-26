import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const seen = vi.hoisted(() => ({
  rows: [] as Props[],
  opened: [] as string[],
}));

vi.mock('@kitbag/core-design', async () => {
  const { createElement: h } = await import('react');
  const pass = (props: Props) => h('div', null, props.children);
  return {
    EditGroup: pass,
    EditValue: (props: Props) => h('span', null, props.children),
    EditRow: (props: Props) => {
      seen.rows.push(props);
      return h('div', null, props.children);
    },
  };
});
vi.mock('./SettingsFrame.tsx', async () => {
  const { createElement: h } = await import('react');
  return {
    SettingsFrame: (props: Props) => h('main', null, props.children),
  };
});
vi.mock('./openUrl.ts', () => ({
  openUrl: (url: string) => {
    seen.opened.push(url);
  },
}));

const { AttributionsScreen } = await import('./AttributionsScreen.tsx');

it('credits GetSongBPM with a visible link that opens getsongbpm.com', () => {
  const markup = renderToStaticMarkup(
    createElement(AttributionsScreen, { onBack: vi.fn() }),
  );
  const row = seen.rows.find((props) => props.label === 'GetSongBPM');
  expect(markup).toContain('getsongbpm.com');
  expect(row?.accessibilityRole).toBe('link');
  (row?.onPress as () => void)();
  expect(seen.opened).toEqual(['https://getsongbpm.com']);
});
