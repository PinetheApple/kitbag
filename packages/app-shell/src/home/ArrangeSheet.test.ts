import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import {
  ARRANGE_ACTION,
  DEFAULT_ARRANGEMENT,
  type HomeArrangement,
} from './arrangement.ts';
import { TOOL_ID } from './registry.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const rendered = vi.hoisted(() => [] as Record<string, unknown>[]);

vi.mock('react-native', async () => {
  const { createElement: h } = await import('react');
  const host = (props: Props) => {
    rendered.push(props);
    return h('div', null, props.children);
  };
  return {
    Pressable: host,
    Text: host,
    View: host,
    StyleSheet: { absoluteFill: {} },
  };
});

vi.mock('react-native-reanimated', async () => {
  const { createElement: h } = await import('react');
  return {
    default: { View: (props: Props) => h('div', null, props.children) },
    useAnimatedStyle: () => ({}),
  };
});

vi.mock('react-native-gesture-handler', () => ({
  GestureDetector: (props: Props) => props.children,
}));

vi.mock('@kitbag/core-design', async (original) => {
  const { createElement: h } = await import('react');
  const pure = await original<Record<string, unknown>>();
  const host = (props: Props) => {
    rendered.push(props);
    return h('div', null, props.children);
  };
  return {
    ...pure,
    Button: host,
    InlineIcon: () => null,
    SegmentedControl: host,
    Sheet: (props: Props) => h('div', null, props.children),
    createThemedStyles: () => () => new Proxy({}, { get: () => ({}) }),
    hitBoxStyle: () => ({}),
    hitExtension: () => ({}),
    textStyle: () => ({}),
    unshared: (room: number) => room,
    useHandleDrag: () => ({
      pan: {},
      onLayout: () => undefined,
      offset: { value: 0 },
    }),
    useDragGroup: () => ({}),
    useTheme: () => ({ color: {}, shadow: '' }),
  };
});

const { ArrangeSheet } = await import('./ArrangeSheet.tsx');

function render(arrangement: HomeArrangement) {
  rendered.length = 0;
  const onArrange = vi.fn<(next: HomeArrangement) => void>();
  renderToStaticMarkup(
    createElement(ArrangeSheet, {
      visible: true,
      arrangement,
      bottomInset: 0,
      onArrange,
      onDone: () => undefined,
    }),
  );
  return { onArrange };
}

function labelled(prefix: string) {
  const found = rendered.find(
    (props) =>
      typeof props.accessibilityLabel === 'string' &&
      props.accessibilityLabel.startsWith(prefix),
  );
  if (found === undefined) throw new Error(`nothing labelled ${prefix}`);
  return found;
}

function act(prefix: string, actionName: string) {
  const handler = labelled(prefix).onAccessibilityAction as (event: {
    nativeEvent: { actionName: string };
  }) => void;
  handler({ nativeEvent: { actionName } });
}

const ids = (arrangement: HomeArrangement | undefined) =>
  arrangement?.map((t) => t.toolId);

describe('ArrangeSheet accessibility wiring', () => {
  it('gives a middle row move up, move down, resize and hide', () => {
    render(DEFAULT_ARRANGEMENT);
    const actions = labelled('Tuner, 2 of 4').accessibilityActions as {
      label: string;
    }[];
    expect(actions.map((a) => a.label)).toEqual([
      'Move up',
      'Move down',
      'Make 2×1',
      'Hide',
    ]);
  });

  it('moves a row down when the screen reader asks', () => {
    const { onArrange } = render(DEFAULT_ARRANGEMENT);
    act('Tuner, 2 of 4', ARRANGE_ACTION.moveDown);
    expect(ids(onArrange.mock.calls[0]?.[0])).toEqual([
      TOOL_ID.metronome,
      TOOL_ID.library,
      TOOL_ID.tuner,
      TOOL_ID.stems,
    ]);
  });

  it('resizes and hides through the row actions', () => {
    const { onArrange } = render(DEFAULT_ARRANGEMENT);
    act('Songs, 3 of 4', ARRANGE_ACTION.makeWide);
    act('Songs, 3 of 4', ARRANGE_ACTION.hide);
    const [resized, hidden] = onArrange.mock.calls.map(([next]) => next);
    expect(resized?.find((t) => t.toolId === TOOL_ID.library)?.size).toBe(
      '2x1',
    );
    expect(hidden?.find((t) => t.toolId === TOOL_ID.library)?.hidden).toBe(
      true,
    );
  });

  it('shows a hidden tool from its row action', () => {
    const hidden = DEFAULT_ARRANGEMENT.map((t) =>
      t.toolId === TOOL_ID.stems ? { ...t, hidden: true } : t,
    );
    const { onArrange } = render(hidden);
    act('Stem songs, hidden', ARRANGE_ACTION.show);
    expect(
      onArrange.mock.calls[0]?.[0].find((t) => t.toolId === TOOL_ID.stems)
        ?.hidden,
    ).toBe(false);
  });

  it('ignores an action name it does not know', () => {
    const { onArrange } = render(DEFAULT_ARRANGEMENT);
    act('Tuner, 2 of 4', 'activate');
    expect(onArrange).not.toHaveBeenCalled();
  });
});
