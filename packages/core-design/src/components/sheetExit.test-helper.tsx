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
import { beforeEach, vi } from 'vitest';

import {
  anim,
  dismissKeyboard,
  focusReaderOn,
  frames,
  FULL,
  keyboard,
  REDUCED,
} from './sheetExitState.test-helper.ts';

export {
  anim,
  dismissKeyboard,
  focusReaderOn,
  frames,
  FULL,
  keyboard,
  REDUCED,
} from './sheetExitState.test-helper.ts';

interface Timing {
  readonly to: number;
  readonly done?: (finished: boolean) => void;
}

vi.mock('react-native', () => ({
  Platform: { OS: 'android' },
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
        stop() {
          if (done === undefined) return;
          anim.running.delete(done);
          done(false);
          done = undefined;
        },
        set value(next: number | Timing) {
          this.stop();
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
    cancelAnimation: (shared: { stop: () => void }) => {
      shared.stop();
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
      update: undefined as PanHandler | undefined,
      end: undefined as PanHandler | undefined,
    };
    const chain = {
      pan,
      activeOffsetY: () => chain,
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

export const ACTIONS = 'Actions';
export const DELETE = 'Delete';
export const SONG = 'Song';
const noop = () => undefined;

export interface Open {
  readonly actions: boolean;
  readonly owned?: boolean;
  readonly remove: boolean;
  readonly detail?: string | null;
  readonly focus?: RefObject<HostInstance | null>;
}

export function Pair({
  actions,
  owned = true,
  remove,
  detail = SONG,
  focus,
}: Open) {
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

export function mount(open: Open): ReactTestRenderer {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(h(Pair, open), { createNodeMock: titleNode });
  });
  if (tree === undefined) throw new Error('not mounted');
  return tree;
}

export function rerender(tree: ReactTestRenderer, open: Open) {
  act(() => {
    tree.update(h(Pair, open));
  });
}

export function slots(tree: ReactTestRenderer): ReactTestInstance[] {
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

export function titles(tree: ReactTestRenderer): unknown[] {
  return slots(tree).map(titleOf);
}

export function slotTitled(tree: ReactTestRenderer, title: string) {
  const slot = slots(tree).find((each) => titleOf(each) === title);
  if (slot === undefined) throw new Error(`no ${title} slot`);
  return slot;
}

export function finishExits() {
  act(() => {
    for (const done of [...anim.running]) done(true);
  });
}

export function runFrame() {
  act(() => {
    for (const frame of frames.splice(0)) frame();
  });
}

export function settleFrames() {
  while (frames.length > 0) runFrame();
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
