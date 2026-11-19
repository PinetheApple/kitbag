// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act, createElement as h, type ReactElement } from 'react';
import {
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { beforeEach, expect, it, vi } from 'vitest';

interface Timing {
  readonly to: number;
  readonly done?: (finished: boolean) => void;
}

const REDUCED = 'always';
const FULL = 'never';

const anim = vi.hoisted(() => ({
  running: new Set<(finished: boolean) => void>(),
  motion: 'never',
}));
const focusReaderOn = vi.hoisted(() => vi.fn());

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  Text: 'Text',
  View: 'View',
  StyleSheet: {
    create: <T,>(styles: T) => styles,
    absoluteFill: { fill: true },
  },
  useWindowDimensions: () => ({ height: 800 }),
}));
vi.mock('react-native-reanimated', async () => {
  const { useState } = await import('react');
  const isTiming = (next: unknown): next is Timing =>
    typeof next === 'object' && next !== null && 'to' in next;
  const settling = (name: string) => ({
    reduceMotion: () => ({
      withCallback: (settle: (finished: boolean) => void) => ({ name, settle }),
    }),
  });
  function useSharedValue(initial: number) {
    const [shared] = useState(() => {
      let current = initial;
      let done: ((finished: boolean) => void) | undefined;
      return {
        get value() {
          return current;
        },
        set value(next: number | Timing) {
          if (done !== undefined) {
            anim.running.delete(done);
            done(false);
            done = undefined;
          }
          if (!isTiming(next)) {
            current = next;
            return;
          }
          current = next.to;
          const settle = next.done;
          if (settle === undefined) return;
          done = (finished) => {
            done = undefined;
            settle(finished);
          };
          anim.running.add(done);
        },
      };
    });
    return shared;
  }
  return {
    default: { View: 'Animated.View' },
    FadeIn: { reduceMotion: () => 'scrimIn' },
    SlideInDown: settling('sheetIn'),
    useAnimatedStyle: <T,>(style: () => T) => style(),
    useSharedValue,
    withSpring: (to: number) => to,
    withTiming: (
      to: number,
      config: { reduceMotion: string },
      done?: (finished: boolean) => void,
    ) => {
      if (config.reduceMotion === 'always' && done !== undefined)
        queueMicrotask(() => {
          done(true);
        });
      return config.reduceMotion === 'always' ? to : { to, done };
    },
  };
});
vi.mock('react-native-gesture-handler', () => {
  const chain = {
    activeOffsetY: () => chain,
    onUpdate: () => chain,
    onEnd: () => chain,
  };
  return {
    Gesture: { Pan: () => chain },
    GestureDetector: 'GestureDetector',
  };
});
vi.mock('react-native-keyboard-controller', () => ({
  useReanimatedKeyboardAnimation: () => ({ height: { value: 0 } }),
}));
vi.mock('react-native-worklets', () => ({
  scheduleOnRN: (fn: () => void) => {
    fn();
  },
}));
vi.mock('./IconGlyph.tsx', () => ({ InlineIcon: 'InlineIcon' }));
vi.mock('./hardwareBack', () => ({ onHardwareBack: () => () => undefined }));
vi.mock('../readerFocus', () => ({ focusReaderOn }));
vi.mock('../useReduceMotion.ts', () => ({
  useReduceMotionMode: () => anim.motion,
}));
vi.mock('../ThemeProvider.tsx', async () => {
  const { themes } = await import('../theme.ts');
  return {
    createThemedStyles:
      <T,>(factory: (theme: typeof themes.dark) => T) =>
      () =>
        factory(themes.dark),
  };
});

const { Sheet } = await import('./Sheet.tsx');
const { SheetHost } = await import('./SheetHost.tsx');

const ACTIONS = 'Actions';
const DELETE = 'Delete';
const noop = () => undefined;

interface Open {
  readonly actions: boolean;
  readonly remove: boolean;
}

function Pair({ actions, remove }: Open) {
  return (
    <SheetHost topInset={0}>
      <Sheet
        visible={actions}
        title={ACTIONS}
        dismissLabel="Close actions"
        onDismiss={noop}
      >
        {null}
      </Sheet>
      <Sheet
        visible={remove}
        title={DELETE}
        dismissLabel="Cancel delete"
        onDismiss={noop}
      >
        {null}
      </Sheet>
    </SheetHost>
  );
}

function titleNode(element: ReactElement) {
  return { title: (element.props as { children?: unknown }).children };
}

function mount(open: Open): ReactTestRenderer {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(h(Pair, open), { createNodeMock: titleNode });
  });
  if (tree === undefined) throw new Error('not mounted');
  return tree;
}

function rerender(tree: ReactTestRenderer, open: Open) {
  act(() => {
    tree.update(h(Pair, open));
  });
}

function slots(tree: ReactTestRenderer): ReactTestInstance[] {
  return tree.root.findAll(
    (node) =>
      node.type === ('View' as never) &&
      (node.props.style as { fill?: boolean } | undefined)?.fill === true &&
      node.props.collapsable === false,
  );
}

function titleOf(slot: ReactTestInstance): unknown {
  return slot.find((node) => node.props.accessibilityRole === 'header').props
    .children;
}

function titles(tree: ReactTestRenderer): unknown[] {
  return slots(tree).map(titleOf);
}

function slotTitled(tree: ReactTestRenderer, title: string) {
  const slot = slots(tree).find((each) => titleOf(each) === title);
  if (slot === undefined) throw new Error(`no ${title} slot`);
  return slot;
}

function finishExits() {
  act(() => {
    for (const done of [...anim.running]) done(true);
  });
}

beforeEach(() => {
  anim.running.clear();
  anim.motion = FULL;
  focusReaderOn.mockClear();
});

it('keeps a sheet swapped out in one commit until its exit finishes', () => {
  const tree = mount({ actions: true, remove: false });
  rerender(tree, { actions: false, remove: true });
  expect(titles(tree)).toEqual([ACTIONS, DELETE]);
  finishExits();
  expect(titles(tree)).toEqual([DELETE]);
});

it('leaves no layout exit animation in the tree', () => {
  const tree = mount({ actions: true, remove: false });
  rerender(tree, { actions: false, remove: true });
  expect(tree.root.findAll((node) => 'exiting' in node.props)).toEqual([]);
});

it('takes the leaving sheet out of touch and reader reach while the new one gets focus', () => {
  const tree = mount({ actions: true, remove: false });
  rerender(tree, { actions: false, remove: true });
  const leaving = slotTitled(tree, ACTIONS);
  const arriving = slotTitled(tree, DELETE);
  expect(leaving.props).toMatchObject({
    pointerEvents: 'none',
    importantForAccessibility: 'no-hide-descendants',
  });
  expect(arriving.props).toMatchObject({
    pointerEvents: 'auto',
    importantForAccessibility: 'auto',
  });
  const slide = arriving.find(
    (node) =>
      (node.props.entering as { name?: string } | undefined)?.name ===
      'sheetIn',
  );
  act(() => {
    (slide.props.entering as { settle: (finished: boolean) => void }).settle(
      true,
    );
  });
  expect(focusReaderOn).toHaveBeenCalledExactlyOnceWith({ title: DELETE });
});

it('keeps a sheet that is shown again before its exit finishes', () => {
  const tree = mount({ actions: true, remove: false });
  rerender(tree, { actions: false, remove: false });
  rerender(tree, { actions: true, remove: false });
  finishExits();
  expect(titles(tree)).toEqual([ACTIONS]);
  expect(slotTitled(tree, ACTIONS).props.pointerEvents).toBe('auto');
});

it('removes the sheet on the next tick under reduce motion', async () => {
  anim.motion = REDUCED;
  const tree = mount({ actions: true, remove: false });
  rerender(tree, { actions: false, remove: false });
  await act(async () => {
    await Promise.resolve();
  });
  expect(titles(tree)).toEqual([]);
});
