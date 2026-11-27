import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const rows = vi.hoisted(() => [] as Props[]);

vi.mock('@kitbag/core-design', async (original) => {
  const { createElement: h } = await import('react');
  return {
    ...(await original<Record<string, unknown>>()),
    Sheet: (props: Props) => h('section', null, props.children),
    MenuRow: (props: Props) => {
      rows.push(props);
      return null;
    },
  };
});

const { PlayAlongMenu } = await import('./PlayAlongMenu.tsx');

const onClickSound = vi.fn();
const onNotificationAccess = vi.fn();

it('lists Click sound with the picked sound, then Notification access', () => {
  renderToStaticMarkup(
    createElement(PlayAlongMenu, {
      visible: true,
      access: true,
      soundLabel: 'Woodblock',
      bottomInset: 0,
      onClickSound,
      onNotificationAccess,
      onDismiss: vi.fn(),
    }),
  );
  expect(rows.map(({ icon, label, value }) => [icon, label, value])).toEqual([
    ['sound', 'Click sound', 'Woodblock'],
    ['info', 'Notification access', 'On'],
  ]);
  expect(rows[0]?.onPress).toBe(onClickSound);
  expect(rows[1]?.onPress).toBe(onNotificationAccess);
});
