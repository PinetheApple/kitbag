// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import {
  act,
  createElement as h,
  type ReactElement,
  type ReactNode,
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
  TextInput: 'TextInput',
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
  const noRef = () => undefined;
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
  function useAnimatedReaction<T>(
    prepare: () => T,
    react: (now: T, previous: T | null) => void,
  ) {
    const [handle] = useState(() => {
      const created = { prepare, react, previous: null as T | null };
      anim.reactions.push(() => {
        const now = created.prepare();
        created.react(now, created.previous);
        created.previous = now;
      });
      return created;
    });
    handle.prepare = prepare;
    handle.react = react;
  }
  return {
    default: {
      View: 'Animated.View',
      Text: 'Animated.Text',
      ScrollView: 'Animated.ScrollView',
      createAnimatedComponent: (component: string) => `Animated.${component}`,
    },
    SlideInDown: settling('sheetIn'),
    cancelAnimation: (shared: { stop: () => void }) => {
      shared.stop();
    },
    useAnimatedProps: useAnimatedStyle,
    useAnimatedReaction,
    useAnimatedRef: () => Object.assign(noRef, { current: null }),
    useAnimatedScrollHandler: <T,>(handlers: T) => handlers,
    useFrameCallback: (callback: (frame: { timestamp: number }) => void) => {
      const [registered] = useState(() => {
        anim.frameCallbacks.push(callback);
        return true;
      });
      return registered;
    },
    useAnimatedStyle,
    useSharedValue,
    scrollTo: (_ref: unknown, _x: number, y: number) => {
      anim.scrolls.push(y);
    },
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
  interface PanEvent {
    readonly translationY: number;
  }
  type PanCallback = (event: PanEvent & { canceled: boolean }) => void;
  type PanHandler = (event: PanEvent, success?: boolean) => void;
  const PAN_STAGES = {
    onBegin: 'begin',
    onActivate: 'start',
    onUpdate: 'update',
    onDeactivate: 'end',
    onFinalize: 'finalize',
  } as const;
  function usePanGesture(config: Partial<Record<string, PanCallback>>) {
    const pan: Partial<Record<string, PanHandler>> = {};
    for (const [key, stage] of Object.entries(PAN_STAGES)) {
      const callback = config[key];
      if (callback !== undefined)
        pan[stage] = (event, success = true) => {
          callback({ ...event, canceled: !success });
        };
    }
    return { pan };
  }
  return {
    usePanGesture,
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
  useReduceMotion: () => anim.motion === REDUCED,
  useReduceMotionMode: () => anim.motion,
}));
vi.mock('../ThemeProvider.tsx', async () => {
  const { themes } = await import('../theme.ts');
  return {
    useTheme: () => themes.dark,
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
  readonly closed?: () => void;
  readonly content?: ReactNode;
}

export function Pair({
  actions,
  owned = true,
  remove,
  detail = SONG,
  focus,
  closed,
  content,
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
          {...(closed === undefined ? {} : { onClosed: closed })}
        >
          {content ?? (detail === null ? null : h('Detail', { name: detail }))}
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

export function runReactions() {
  act(() => {
    for (const reaction of anim.reactions) reaction();
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
  anim.reactions.length = 0;
  anim.frameCallbacks.length = 0;
  anim.scrolls.length = 0;
  dismissKeyboard.mockClear();
  anim.motion = FULL;
  focusReaderOn.mockClear();
});
