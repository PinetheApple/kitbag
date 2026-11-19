import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const sheets = vi.hoisted(() => [] as Props[]);
const permission = vi.hoisted(() => ({ reason: 'playback' }));

vi.mock('react-native', () => ({ View: 'div' }));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0 }),
}));
vi.mock('@kitbag/core-state', () => ({
  useNotificationPermission: (select: (state: object) => unknown) =>
    select({
      prompting: true,
      reason: permission.reason,
      allow: () => Promise.resolve(),
      notNow: () => undefined,
    }),
}));
vi.mock('@kitbag/core-design', async () => {
  const { createElement: h } = await import('react');
  return {
    Button: () => null,
    createThemedStyles: () => () => ({}),
    space: {},
    Sheet: (props: Props) => {
      sheets.push(props);
      return h('section', null, props.children);
    },
    SheetHint: (props: Props) => h('p', null, props.children),
  };
});

const { NotificationPromptSheet } =
  await import('./NotificationPromptSheet.tsx');

function render(reason: string) {
  permission.reason = reason;
  const html = renderToStaticMarkup(createElement(NotificationPromptSheet));
  return { title: sheets.at(-1)?.title, html };
}

describe('the notification ask', () => {
  it('keeps the playback words for playback', () => {
    const { title, html } = render('playback');
    expect(title).toBe('Show the playback card?');
    expect(html).toContain(
      'Allow notifications to control playback from the shade and the lock screen.',
    );
  });

  it('asks about import progress on the first import', () => {
    const { title, html } = render('import');
    expect(title).toBe('Show import progress?');
    expect(html).toContain(
      'Allow notifications to see songs coming in after you leave Kitbag, and when they are done.',
    );
  });
});
