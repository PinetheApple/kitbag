/* eslint-disable @typescript-eslint/no-deprecated */
import { act, createElement as h } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';

import {
  mount,
  rerender,
  runReactions,
  type Open,
} from './sheetExit.test-helper.tsx';

vi.mock('./Icon.tsx', () => ({ Icon: 'Icon' }));
vi.mock('./PlainListRow.tsx', () => ({
  RowPress: 'RowPress',
  usePlainRowStyles: () => ({}),
}));

const { LiveText } = await import('./LiveText.tsx');
const { WheelPicker } = await import('./WheelPicker.tsx');
const { useHandleDrag } = await import('./DragListRow.tsx');
const { useSheetContentLive } = await import('./sheetContentLive.ts');

const SHOWN = '0:01';
const LATER = '0:02';
const VALUES = [1, 2, 3, 4];
const FAR_DOWN = 1_000_000;
const DRAGGED = 40;
const DRAGGED_FURTHER = 80;
const noop = () => undefined;

interface Updating<T> {
  readonly updater: () => T;
}

function inSheet(content: Open['content'], visible: boolean): Open {
  return { actions: visible, remove: false, content };
}

function shownText(tree: ReactTestRenderer): unknown {
  const input = tree.root.find(
    (node) => node.type === ('Animated.TextInput' as never),
  );
  const props = input.props.animatedProps as Updating<{ text: string }>;
  return props.updater().text;
}

function scrollTo(tree: ReactTestRenderer, y: number) {
  const scroll = tree.root.find(
    (node) => node.type === ('Animated.ScrollView' as never),
  );
  const handlers = scroll.props.onScroll as {
    onScroll: (event: { contentOffset: { y: number } }) => void;
  };
  act(() => {
    handlers.onScroll({ contentOffset: { y } });
  });
}

function chosenValues(tree: ReactTestRenderer): unknown[] {
  return tree.root
    .findAll((node) => node.type === ('Animated.Text' as never))
    .filter((node) => {
      const [base, look] = node.props.style as [
        { position?: string },
        Updating<{ opacity: number }>,
      ];
      return base.position === 'absolute' && look.updater().opacity === 1;
    })
    .map((node) => node.props.children as unknown);
}

interface DragProbeProps {
  readonly seen: { drag?: ReturnType<typeof useHandleDrag> };
}

function DragProbe({ seen }: DragProbeProps) {
  seen.drag = useHandleDrag({ index: 0, count: VALUES.length, onMove: noop });
  return null;
}

function dragBy(seen: DragProbeProps['seen'], translationY: number) {
  const pan = seen.drag?.pan as unknown as {
    pan: { update?: (event: { translationY: number }) => void };
  };
  act(() => {
    pan.pan.update?.({ translationY });
  });
}

function LiveProbe({ seen }: { readonly seen: { live?: boolean } }) {
  seen.live = useSheetContentLive().value;
  return null;
}

it('holds live text while its sheet leaves and follows it again once shown', () => {
  const text = { value: SHOWN };
  const content = h(LiveText, { text: text as never, role: 'rowSubtitle' });
  const tree = mount(inSheet(content, true));
  runReactions();
  expect(shownText(tree)).toBe(SHOWN);
  rerender(tree, inSheet(content, false));
  text.value = LATER;
  runReactions();
  expect(shownText(tree)).toBe(SHOWN);
  rerender(tree, inSheet(content, true));
  runReactions();
  expect(shownText(tree)).toBe(LATER);
});

it("stops a wheel's fling from moving its selection while its sheet leaves", () => {
  const content = h(WheelPicker, {
    values: VALUES,
    selected: VALUES[0] ?? 0,
    onSelect: noop,
    accessibilityLabel: 'Beats',
  });
  const tree = mount(inSheet(content, true));
  scrollTo(tree, FAR_DOWN);
  expect(chosenValues(tree)).toEqual([String(VALUES.at(-1))]);
  rerender(tree, inSheet(content, false));
  scrollTo(tree, 0);
  expect(chosenValues(tree)).toEqual([String(VALUES.at(-1))]);
});

it('stops a row drag from moving the row while its sheet leaves', () => {
  const seen: DragProbeProps['seen'] = {};
  const content = h(DragProbe, { seen });
  const tree = mount(inSheet(content, true));
  dragBy(seen, DRAGGED);
  expect(seen.drag?.offset.value).toBe(DRAGGED);
  rerender(tree, inSheet(content, false));
  dragBy(seen, DRAGGED_FURTHER);
  expect(seen.drag?.offset.value).toBe(DRAGGED);
});

it('keeps content outside any sheet live', () => {
  const seen: { live?: boolean } = {};
  act(() => {
    create(h(LiveProbe, { seen }));
  });
  expect(seen.live).toBe(true);
});
