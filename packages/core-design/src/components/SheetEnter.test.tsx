// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act } from 'react';
import type { HostInstance } from 'react-native';
import type { ReactTestInstance, ReactTestRenderer } from 'react-test-renderer';
import { expect, it, vi } from 'vitest';

import {
  ACTIONS,
  anim,
  finishExits,
  focusReaderOn,
  lastTiming,
  layOutSlot,
  mount,
  rerender,
  slotTitled,
  WINDOW_HEIGHT,
  type Open,
} from './sheetExit.test-helper.tsx';

const DRAG_DISTANCE = 40;
const CLOSED = { actions: false, remove: false } as const;
const OPEN = { actions: true, remove: false } as const;

interface Animated {
  readonly updater: () => { transform?: { translateY: number }[] };
}

function translateY(node: ReactTestInstance | undefined): number | undefined {
  const parts: unknown[] = [node?.props.style].flat(Infinity);
  const animated = parts.find(
    (part): part is Animated =>
      typeof part === 'object' && part !== null && 'updater' in part,
  );
  return animated?.updater().transform?.[0]?.translateY;
}

function moving(tree: ReactTestRenderer) {
  const views = slotTitled(tree, ACTIONS).findAll(
    (node) => node.type === ('Animated.View' as never),
  );
  return { slot: views[1], card: views[2] };
}

function open(shown?: () => void, focus?: Open['focus']) {
  const tree = mount({
    ...OPEN,
    ...(shown === undefined ? {} : { shown }),
    ...(focus === undefined ? {} : { focus }),
  });
  layOutSlot(tree, ACTIONS);
  return tree;
}

function settleSlide(finished: boolean) {
  const slide = lastTiming();
  act(() => {
    slide(finished);
  });
}

it('slides its card up from a window height below by its own value, not a layout animation', () => {
  const tree = open();
  expect(tree.root.findAll((node) => 'entering' in node.props)).toEqual([]);
  expect(translateY(moving(tree).slot)).toBe(WINDOW_HEIGHT);
  settleSlide(true);
  expect(translateY(moving(tree).slot)).toBe(0);
});

it('reports itself shown and moves reader focus to its title only once its card has arrived', () => {
  const shown = vi.fn();
  open(shown);
  expect(shown).not.toHaveBeenCalled();
  expect(focusReaderOn).not.toHaveBeenCalled();
  settleSlide(true);
  expect(shown).toHaveBeenCalledOnce();
  expect(focusReaderOn).toHaveBeenCalledExactlyOnceWith({ title: ACTIONS });
});

it('moves reader focus to the node it was asked to start on once its card has arrived', () => {
  const focus = { current: { start: true } as unknown as HostInstance };
  open(undefined, focus);
  settleSlide(true);
  expect(focusReaderOn).toHaveBeenCalledExactlyOnceWith(focus.current);
});

it('settles the card in place and still reports it shown when its slide is cut short', () => {
  const shown = vi.fn();
  const tree = open(shown);
  settleSlide(false);
  expect(translateY(moving(tree).slot)).toBe(0);
  expect(shown).toHaveBeenCalledOnce();
});

it('does not report a sheet shown when it closes before its card arrives', () => {
  const shown = vi.fn();
  const tree = mount({ ...OPEN, shown });
  rerender(tree, { ...CLOSED, shown });
  finishExits();
  expect(shown).not.toHaveBeenCalled();
});

it('reports a sheet reopened mid-slide shown once, when its slide ends', () => {
  const shown = vi.fn();
  const tree = open(shown);
  const slide = lastTiming();
  rerender(tree, { ...CLOSED, shown });
  rerender(tree, { ...OPEN, shown });
  expect(shown).not.toHaveBeenCalled();
  expect(focusReaderOn).not.toHaveBeenCalled();
  act(() => {
    slide(true);
  });
  expect(shown).toHaveBeenCalledOnce();
  expect(focusReaderOn).toHaveBeenCalledOnce();
});

it('reports a sheet shown again when it returns mid-exit', () => {
  const shown = vi.fn();
  const tree = open(shown);
  settleSlide(true);
  expect(shown).toHaveBeenCalledOnce();
  rerender(tree, { ...CLOSED, shown });
  rerender(tree, { ...OPEN, shown });
  expect(shown).toHaveBeenCalledTimes(2);
});

it('drags the card, not the slot that slides it in', () => {
  const tree = open();
  settleSlide(true);
  const detector = slotTitled(tree, ACTIONS).findByType(
    'GestureDetector' as never,
  );
  const { pan } = detector.props.gesture as {
    pan: { update: (event: { translationY: number }) => void };
  };
  act(() => {
    pan.update({ translationY: DRAG_DISTANCE });
  });
  const { slot, card } = moving(tree);
  expect(translateY(slot)).toBe(0);
  expect(translateY(card)).toBe(DRAG_DISTANCE);
});

it('starts its slide only once its slot has laid out', () => {
  const shown = vi.fn();
  const tree = mount({ ...OPEN, shown });
  expect(anim.timings).toEqual([]);
  finishExits();
  expect(shown).not.toHaveBeenCalled();
  expect(translateY(moving(tree).slot)).toBe(WINDOW_HEIGHT);
  layOutSlot(tree, ACTIONS);
  settleSlide(true);
  expect(shown).toHaveBeenCalledOnce();
  expect(translateY(moving(tree).slot)).toBe(0);
});

it('does not slide again when its slot lays out again', () => {
  const tree = open();
  settleSlide(true);
  layOutSlot(tree, ACTIONS);
  expect(anim.timings).toHaveLength(1);
  expect(translateY(moving(tree).slot)).toBe(0);
});
