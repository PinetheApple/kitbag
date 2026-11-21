import { SHEET_TOUCH_ROOM } from '@kitbag/core-design';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, it, vi } from 'vitest';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const buttons = vi.hoisted(() => [] as Props[]);

vi.mock('react-native', async () => {
  const { createElement: h } = await import('react');
  const host = (props: Props) => h('div', null, props.children);
  return { View: host, Text: host, Pressable: host };
});

vi.mock('@kitbag/core-design', async (original) => {
  const { createElement: h } = await import('react');
  return {
    ...(await original<Record<string, unknown>>()),
    createThemedStyles: () => () => ({}),
    textStyle: () => ({}),
    useTheme: () => ({ accentInk: 'accent' }),
    Icon: () => null,
    SheetHint: () => null,
    Sheet: (props: Props) => h('section', null, props.children),
    Button: (props: Props) => {
      buttons.push(props);
      return null;
    },
  };
});

vi.mock('@kitbag/core-state', () => ({
  tuningFromCustom: (row: unknown) => row,
}));

const { TuningSheet } = await import('./TuningSheet.tsx');

it('gives New tuning the room to the sheet edge below it whole', () => {
  buttons.length = 0;
  renderToStaticMarkup(
    createElement(TuningSheet, {
      visible: true,
      current: null,
      customTunings: [],
      loadFailed: false,
      bottomInset: 0,
      onShow: vi.fn(),
      onSelect: vi.fn(),
      onEdit: vi.fn(),
      onNew: vi.fn(),
      onDismiss: vi.fn(),
    }),
  );
  const add = buttons.find((props) => props.label === 'New tuning');
  expect(add?.edgeRoomDp).toEqual({ bottom: SHEET_TOUCH_ROOM });
  expect((add?.neighbourGapDp as { bottom?: number }).bottom).toBeUndefined();
});
