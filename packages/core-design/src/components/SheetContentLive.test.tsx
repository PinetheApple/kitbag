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
const { useSheetContentLive } = await import('./sheetContentLive.ts');
const { useHandleDrag, useDragGroup } = await import('./DragListRow.tsx');
const { LinearProgress } = await import('./LinearProgress.tsx');
const { NO_DRAG } = await import('../dragReorder.ts');
const { anim } = await import('./sheetExitState.test-helper.ts');

const SHOWN = '0:01';
const LATER = '0:02';
const VALUES = [1, 2, 3, 4];
const FAR_DOWN = 1_000_000;
const DRAGGED = 40;
const ROW_HEIGHT = 40;
const DRAGGED_FURTHER = 80;
const TRACK_WIDTH = 200;
const EARLY_MS = 100;
const LATER_MS = 300;
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

type ScrollProp =
  'onScrollBeginDrag' | 'onMomentumScrollBegin' | 'onMomentumScrollEnd';

function scrollEvent(tree: ReactTestRenderer, prop: ScrollProp, y = 0) {
  const scroll = tree.root.find(
    (node) => node.type === ('Animated.ScrollView' as never),
  );
  const handler = scroll.props[prop] as (event: {
    nativeEvent: { contentOffset: { y: number } };
  }) => void;
  act(() => {
    handler({ nativeEvent: { contentOffset: { y } } });
  });
}

function wheelIn(onSelect: (value: number) => void) {
  return h(WheelPicker, {
    values: VALUES,
    selected: VALUES[0] ?? 0,
    onSelect,
    accessibilityLabel: 'Beats',
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

interface DragSeen {
  drag?: ReturnType<typeof useHandleDrag>;
  group?: ReturnType<typeof useDragGroup>;
}

interface DragProbeProps {
  readonly seen: DragSeen;
}

function DragProbe({ seen }: DragProbeProps) {
  const group = useDragGroup(VALUES);
  seen.group = group;
  seen.drag = useHandleDrag({
    index: 0,
    count: VALUES.length,
    onMove: noop,
    group,
  });
  return null;
}

type PanStage = 'begin' | 'start' | 'update' | 'end' | 'finalize';

function panStage(seen: DragSeen, stage: PanStage, translationY = 0) {
  const pan = seen.drag?.pan as unknown as {
    pan: Partial<
      Record<PanStage, (event: { translationY: number }, ok: boolean) => void>
    >;
  };
  act(() => {
    pan.pan[stage]?.({ translationY }, true);
  });
}

function dragBy(seen: DragSeen, translationY: number) {
  panStage(seen, 'update', translationY);
}

function bandOffset(tree: ReactTestRenderer): number {
  const band = tree.root.find(
    (node) =>
      node.type === ('Animated.View' as never) &&
      Array.isArray(node.props.style) &&
      node.parent?.props.onLayout !== undefined,
  );
  const sweep = (band.props.style as unknown[]).at(-1) as Updating<{
    transform: [{ translateX: number }];
  }>;
  return sweep.updater().transform[0].translateX;
}

function layOutBand(tree: ReactTestRenderer) {
  const track = tree.root.find(
    (node) =>
      node.type === ('View' as never) &&
      node.props.onLayout !== undefined &&
      node.findAll((child) => child.type === ('Animated.View' as never))
        .length > 0,
  );
  const onLayout = track.props.onLayout as (event: {
    nativeEvent: { layout: { width: number } };
  }) => void;
  act(() => {
    onLayout({ nativeEvent: { layout: { width: TRACK_WIDTH } } });
  });
}

function frameAt(timestamp: number) {
  act(() => {
    for (const callback of anim.frameCallbacks) callback({ timestamp });
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
  const seen: DragSeen = {};
  const content = h(DragProbe, { seen });
  const tree = mount(inSheet(content, true));
  dragBy(seen, DRAGGED);
  expect(seen.drag?.offset.value).toBe(DRAGGED);
  rerender(tree, inSheet(content, false));
  dragBy(seen, DRAGGED_FURTHER);
  expect(seen.drag?.offset.value).toBe(DRAGGED);
});

it('resyncs a wheel to its selection when its sheet reopens mid-exit', () => {
  const content = h(WheelPicker, {
    values: VALUES,
    selected: VALUES[0] ?? 0,
    onSelect: noop,
    accessibilityLabel: 'Beats',
  });
  const tree = mount(inSheet(content, true));
  runReactions();
  scrollTo(tree, FAR_DOWN);
  rerender(tree, inSheet(content, false));
  runReactions();
  rerender(tree, inSheet(content, true));
  runReactions();
  expect(chosenValues(tree)).toEqual([String(VALUES[0])]);
});

it('drops a fling that outlives its sheet into a reopen and shows the selection again', () => {
  const onSelect = vi.fn();
  const content = wheelIn(onSelect);
  const tree = mount(inSheet(content, true));
  runReactions();
  scrollEvent(tree, 'onScrollBeginDrag');
  scrollTo(tree, FAR_DOWN);
  scrollEvent(tree, 'onMomentumScrollBegin');
  rerender(tree, inSheet(content, false));
  runReactions();
  rerender(tree, inSheet(content, true));
  runReactions();
  scrollTo(tree, FAR_DOWN);
  scrollEvent(tree, 'onMomentumScrollEnd', FAR_DOWN);
  expect(onSelect).not.toHaveBeenCalled();
  expect(chosenValues(tree)).toEqual([String(VALUES[0])]);
  expect(anim.scrolls.at(-1)).toBe(0);
});

it('drops a fling that ends while its sheet leaves and selects normally after the reopen', () => {
  const onSelect = vi.fn();
  const content = wheelIn(onSelect);
  const tree = mount(inSheet(content, true));
  runReactions();
  scrollEvent(tree, 'onMomentumScrollBegin');
  rerender(tree, inSheet(content, false));
  runReactions();
  scrollEvent(tree, 'onMomentumScrollEnd', FAR_DOWN);
  expect(onSelect).not.toHaveBeenCalled();
  rerender(tree, inSheet(content, true));
  runReactions();
  expect(anim.scrolls.at(-1)).toBe(0);
  scrollEvent(tree, 'onMomentumScrollEnd', FAR_DOWN);
  expect(onSelect).toHaveBeenCalledWith(VALUES.at(-1));
});

it('drops a lifted row when its sheet reopens mid-exit', () => {
  const seen: DragSeen = {};
  const content = h(DragProbe, { seen });
  const tree = mount(inSheet(content, true));
  runReactions();
  panStage(seen, 'begin');
  panStage(seen, 'start');
  dragBy(seen, DRAGGED);
  rerender(tree, inSheet(content, false));
  runReactions();
  panStage(seen, 'finalize');
  rerender(tree, inSheet(content, true));
  runReactions();
  expect(seen.drag?.offset.value).toBe(0);
  expect(seen.group?.from.value).toBe(NO_DRAG);
});

it('does not lift a row whose drag starts while its sheet leaves', () => {
  const seen: DragSeen = {};
  const content = h(DragProbe, { seen });
  const tree = mount(inSheet(content, true));
  rerender(tree, inSheet(content, false));
  panStage(seen, 'begin');
  panStage(seen, 'start');
  expect(seen.group?.from.value).toBe(NO_DRAG);
  expect(seen.group?.target.value).toBe(NO_DRAG);
});

it("stops a progress band's sweep while its sheet leaves", () => {
  const content = h(LinearProgress, {
    percent: null,
    accessibilityLabel: 'Preparing',
  });
  const tree = mount(inSheet(content, true));
  layOutBand(tree);
  frameAt(EARLY_MS);
  const early = bandOffset(tree);
  frameAt(LATER_MS);
  const later = bandOffset(tree);
  expect(later).not.toBe(early);
  rerender(tree, inSheet(content, false));
  frameAt(EARLY_MS);
  expect(bandOffset(tree)).toBe(later);
});

it('keeps content outside any sheet live', () => {
  const seen: { live?: boolean } = {};
  act(() => {
    create(h(LiveProbe, { seen }));
  });
  expect(seen.live).toBe(true);
});

it('does not leave a row lifted by a moved flag left over from an earlier drag', () => {
  const seen: DragSeen = {};
  const content = h(DragProbe, { seen });
  const tree = mount(inSheet(content, true));
  runReactions();
  act(() => {
    seen.drag?.onLayout({
      nativeEvent: { layout: { height: ROW_HEIGHT } },
    } as never);
  });
  panStage(seen, 'begin');
  panStage(seen, 'start');
  panStage(seen, 'end', FAR_DOWN);
  panStage(seen, 'finalize');
  rerender(tree, inSheet(content, false));
  runReactions();
  panStage(seen, 'begin');
  rerender(tree, inSheet(content, true));
  runReactions();
  dragBy(seen, DRAGGED);
  panStage(seen, 'end');
  panStage(seen, 'finalize');
  expect(seen.drag?.offset.value).toBe(0);
});
