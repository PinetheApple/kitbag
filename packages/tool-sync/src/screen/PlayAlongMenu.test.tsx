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

const onSave = vi.fn();
const onClickSound = vi.fn();

function drawMenu(save: (() => void) | null) {
  rows.length = 0;
  renderToStaticMarkup(
    createElement(PlayAlongMenu, {
      visible: true,
      access: true,
      soundLabel: 'Woodblock',
      bottomInset: 0,
      onSave: save,
      onClickSound,
      onNotificationAccess,
      onDismiss: vi.fn(),
    }),
  );
}
const onNotificationAccess = vi.fn();

it('lists Save for this song first, then Click sound and Notification access', () => {
  drawMenu(onSave);
  expect(rows.map(({ icon, label, value }) => [icon, label, value])).toEqual([
    ['saveInto', 'Save for this song', undefined],
    ['sound', 'Click sound', 'Woodblock'],
    ['info', 'Notification access', 'On'],
  ]);
  expect(rows.map((row) => row.onPress)).toEqual([
    onSave,
    onClickSound,
    onNotificationAccess,
  ]);
});

it('leaves Save for this song out while there is no lock to save', () => {
  drawMenu(null);
  expect(rows.map((row) => row.label)).toEqual([
    'Click sound',
    'Notification access',
  ]);
});
