// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import {
  act,
  createElement as h,
  type ReactElement,
  type RefObject,
} from 'react';
import type { HostInstance } from 'react-native';
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

const { anim, REDUCED, FULL } = vi.hoisted(() => {
  const full = 'never';
  return {
    REDUCED: 'always',
    FULL: full,
    anim: {
      running: new Set<(finished: boolean) => void>(),
      exits: [] as ((finished: boolean) => void)[],
      motion: full,
    },
  };
});
const focusReaderOn = vi.hoisted(() => vi.fn());
const keyboard = vi.hoisted(() => ({ height: { value: 0 } }));
const frames = vi.hoisted(() => [] as (() => void)[]);
const dismissKeyboard = vi.hoisted(() => vi.fn());

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  Text: 'Text',
  View: 'View',
  Keyboard: { dismiss: dismissKeyboard },
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
  function useAnimatedStyle<T>(updater: () => T) {
    const [handle] = useState(() => ({ updater }));
    handle.updater = updater;
    return handle;
  }
  return {
    default: { View: 'Animated.View' },
    SlideInDown: settling('sheetIn'),
    cancelAnimation: (shared: { value: number }) => {
      const at = shared.value;
      shared.value = at;
    },
    useAnimatedStyle,
    useSharedValue,
    withSpring: (to: number) => to,
    withTiming: (
      to: number,
      config: { reduceMotion: string },
      done?: (finished: boolean) => void,
    ) => {
      if (done !== undefined) anim.exits.push(done);
      if (config.reduceMotion !== REDUCED) return { to, done };
      if (done !== undefined)
        queueMicrotask(() => {
          done(true);
        });
      return to;
    },
  };
});
vi.mock('react-native-gesture-handler', () => {
  type PanHandler = (event: { translationY: number }) => void;
  function Pan() {
    const pan = {
      enabled: true,
      update: undefined as PanHandler | undefined,
      end: undefined as PanHandler | undefined,
    };
    const chain = {
      pan,
      activeOffsetY: () => chain,
      enabled: (on: boolean) => {
        pan.enabled = on;
        return chain;
      },
      onUpdate: (handler: PanHandler) => {
        pan.update = handler;
        return chain;
      },
      onEnd: (handler: PanHandler) => {
        pan.end = handler;
        return chain;
      },
    };
    return chain;
  }
  return {
    Gesture: { Pan },
    GestureDetector: 'GestureDetector',
  };
});
vi.mock('react-native-keyboard-controller', () => ({
  useReanimatedKeyboardAnimation: () => keyboard,
}));
vi.mock('react-native-worklets', () => {
  const run = <A extends unknown[]>(fn: (...args: A) => void, ...args: A) => {
    fn(...args);
  };
  return { scheduleOnRN: run, scheduleOnUI: run };
});
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
const SONG = 'Song';
const KEYBOARD_OPEN = -300;
const KEYBOARD_CLOSING = -120;
const SHORT_DRAG = 40;
const noop = () => undefined;

interface Open {
  readonly actions: boolean;
  readonly owned?: boolean;
  readonly remove: boolean;
  readonly detail?: string | null;
  readonly focus?: RefObject<HostInstance | null>;
}

function Pair({ actions, owned = true, remove, detail = SONG, focus }: Open) {
  return (
    <SheetHost topInset={0}>
      {owned ? (
        <Sheet
          visible={actions}
          title={ACTIONS}
          dismissLabel="Close actions"
          onDismiss={noop}
          {...(focus === undefined ? {} : { initialFocusRef: focus })}
        >
          {detail === null ? null : h('Detail', { name: detail })}
        </Sheet>
      ) : null}
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

function runFrame() {
  act(() => {
    for (const frame of frames.splice(0)) frame();
  });
}

function settleFrames() {
  while (frames.length > 0) runFrame();
}

interface PanHandle {
  readonly pan: {
    readonly enabled: boolean;
    readonly update?: (event: { translationY: number }) => void;
    readonly end?: (event: { translationY: number }) => void;
  };
}

function shortDrag(tree: ReactTestRenderer, title: string) {
  const detector = slotTitled(tree, title).find(
    (node) => node.type === ('GestureDetector' as never),
  );
  const { pan } = detector.props.gesture as PanHandle;
  if (!pan.enabled) return;
  const event = { translationY: SHORT_DRAG };
  act(() => {
    pan.update?.(event);
    pan.end?.(event);
  });
}

interface StyleHandle {
  readonly updater: () => { paddingBottom?: number };
}

function cardPadding(tree: ReactTestRenderer, title: string): unknown {
  const handles = slotTitled(tree, title)
    .findAll((node) => Array.isArray(node.props.style))
    .flatMap((node) => node.props.style as unknown[])
    .filter(
      (style): style is StyleHandle =>
        typeof (style as Partial<StyleHandle> | null)?.updater === 'function',
    );
  return handles
    .map((handle) => handle.updater().paddingBottom)
    .find((padding) => padding !== undefined);
}

beforeEach(() => {
  frames.length = 0;
  vi.stubGlobal('requestAnimationFrame', (frame: () => void) =>
    frames.push(frame),
  );
  keyboard.height.value = 0;
  anim.running.clear();
  anim.exits.length = 0;
  dismissKeyboard.mockClear();
  anim.motion = FULL;
  focusReaderOn.mockClear();
});

it('keeps a sheet swapped out in one commit until its exit finishes', () => {
  const tree = mount({ actions: true, remove: false });
  rerender(tree, { actions: false, remove: true });
  expect(titles(tree)).toEqual([ACTIONS, DELETE]);
  finishExits();
  settleFrames();
  expect(titles(tree)).toEqual([DELETE]);
});

it('removes a leaving slot only after a frame has run past its exit', () => {
  const tree = mount({ actions: true, remove: false });
  rerender(tree, { actions: false, remove: true });
  finishExits();
  expect(titles(tree)).toEqual([ACTIONS, DELETE]);
  let framesRun = 0;
  while (titles(tree).length > 1 && frames.length > 0) {
    runFrame();
    framesRun += 1;
  }
  expect(framesRun).toBeGreaterThan(0);
  expect(titles(tree)).toEqual([DELETE]);
});

it('keeps a sheet shown again after its exit finished but before removal', () => {
  const tree = mount({ actions: true, remove: false });
  rerender(tree, { actions: false, remove: false });
  finishExits();
  rerender(tree, { actions: true, remove: false });
  settleFrames();
  expect(titles(tree)).toEqual([ACTIONS]);
  expect(focusReaderOn).toHaveBeenCalledExactlyOnceWith({ title: ACTIONS });
});

it('lets a drag that was under way when the exit started neither stop nor undo it', () => {
  const tree = mount({ actions: true, remove: false });
  rerender(tree, { actions: false, remove: false });
  shortDrag(tree, ACTIONS);
  finishExits();
  settleFrames();
  expect(titles(tree)).toEqual([]);
});

it('removes an open sheet at once when its owner unmounts', () => {
  const tree = mount({ actions: true, remove: false });
  rerender(tree, { actions: true, owned: false, remove: false });
  expect(titles(tree)).toEqual([]);
});

it('lets only the latest exit remove a sheet hidden, shown and hidden again', () => {
  const tree = mount({ actions: true, remove: false });
  rerender(tree, { actions: false, remove: false });
  finishExits();
  rerender(tree, { actions: true, remove: false });
  rerender(tree, { actions: false, remove: false });
  settleFrames();
  expect(titles(tree)).toEqual([ACTIONS]);
  finishExits();
  settleFrames();
  expect(titles(tree)).toEqual([]);
});

it('stops a sheet whose owner unmounts mid-exit before removing it', () => {
  const tree = mount({ actions: true, remove: false });
  rerender(tree, { actions: false, remove: false });
  rerender(tree, { actions: false, owned: false, remove: false });
  expect(anim.running.size).toBe(0);
  expect(titles(tree)).toEqual([ACTIONS]);
  settleFrames();
  expect(titles(tree)).toEqual([]);
});

it('follows the keyboard while open and holds its padding while leaving', () => {
  const tree = mount({ actions: true, remove: false });
  const closed = cardPadding(tree, ACTIONS);
  keyboard.height.value = KEYBOARD_OPEN;
  const open = cardPadding(tree, ACTIONS);
  expect(open).not.toEqual(closed);
  rerender(tree, { actions: false, remove: false });
  keyboard.height.value = KEYBOARD_CLOSING;
  expect(cardPadding(tree, ACTIONS)).toEqual(open);
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

it('removes the sheet once its immediate exit settles under reduce motion', async () => {
  anim.motion = REDUCED;
  const tree = mount({ actions: true, remove: false });
  rerender(tree, { actions: false, remove: false });
  await act(async () => {
    await Promise.resolve();
  });
  settleFrames();
  expect(titles(tree)).toEqual([]);
});

it('keeps showing what a sheet last held while it slides out', () => {
  const tree = mount({ actions: true, remove: false });
  rerender(tree, { actions: false, remove: false, detail: null });
  const details = slotTitled(tree, ACTIONS).findAll(
    (node) => node.type === ('Detail' as never),
  );
  expect(details.map((node): unknown => node.props.name)).toEqual([SONG]);
});

it('drops the keyboard once a sheet starts to leave', () => {
  const tree = mount({ actions: true, remove: false });
  expect(dismissKeyboard).not.toHaveBeenCalled();
  rerender(tree, { actions: false, remove: false });
  expect(dismissKeyboard).toHaveBeenCalledOnce();
});

it('moves reader focus back to the title of a sheet shown again mid-exit', () => {
  const tree = mount({ actions: true, remove: false });
  rerender(tree, { actions: false, remove: false });
  rerender(tree, { actions: true, remove: false });
  expect(focusReaderOn).toHaveBeenCalledExactlyOnceWith({ title: ACTIONS });
});

it('puts a sheet shown again mid-exit above one opened meanwhile', () => {
  const tree = mount({ actions: true, remove: false });
  rerender(tree, { actions: false, remove: true });
  rerender(tree, { actions: true, remove: true });
  expect(titles(tree)).toEqual([DELETE, ACTIONS]);
  expect(slotTitled(tree, DELETE).props.importantForAccessibility).toBe(
    'no-hide-descendants',
  );
  expect(slotTitled(tree, ACTIONS).props).toMatchObject({
    pointerEvents: 'auto',
    importantForAccessibility: 'auto',
  });
});

it('keeps a sheet shown again when its exit reports finished late', () => {
  const tree = mount({ actions: true, remove: false });
  rerender(tree, { actions: false, remove: false });
  const [settle] = anim.exits.slice(-1);
  if (settle === undefined) throw new Error('no exit started');
  rerender(tree, { actions: true, remove: false });
  act(() => {
    settle(true);
  });
  expect(titles(tree)).toEqual([ACTIONS]);
});

it('moves reader focus back to the initial focus target of a sheet shown again mid-exit', () => {
  const focus = { current: { start: true } as unknown as HostInstance };
  const tree = mount({ actions: true, remove: false, focus });
  rerender(tree, { actions: false, remove: false, focus });
  rerender(tree, { actions: true, remove: false, focus });
  expect(focusReaderOn).toHaveBeenCalledExactlyOnceWith(focus.current);
});
