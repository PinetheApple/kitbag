import { useEffect, useRef } from 'react';
import { afterEach, beforeEach } from 'vitest';

type FrameCallback = (frame: { readonly timestamp: number }) => void;

interface Reaction {
  prepare: () => unknown;
  react: (now: never, before: never) => void;
  last: unknown;
}

const frameCallbacks = new Set<FrameCallback>();
const reactions = new Set<Reaction>();
const FRAME_MS = 16;
const ANIMATED = Symbol('animated style');

interface AnimatedStyle<T> {
  readonly [ANIMATED]: () => T;
}

export const jsHops = { count: 0 };
let timestamp = 0;

export default {
  View: 'Animated.View',
  Text: 'Animated.Text',
  createAnimatedComponent: <T>(component: T): T => component,
};

export function useSharedValue<T>(value: T): { value: T } {
  const shared = useRef({ value });
  return shared.current;
}

export function makeMutable<T>(value: T): { value: T } {
  return { value };
}

export function useAnimatedStyle<T>(style: () => T): AnimatedStyle<T> {
  return { [ANIMATED]: style };
}

export function animatedStyleOf(style: unknown): Record<string, unknown> {
  const live = [style]
    .flat(Infinity)
    .find(
      (part): part is AnimatedStyle<Record<string, unknown>> =>
        typeof part === 'object' && part !== null && ANIMATED in part,
    );
  if (live === undefined) throw new Error('no animated style on this node');
  return live[ANIMATED]();
}

export function useAnimatedProps<T extends object>(props: () => T): T {
  return new Proxy({} as T, {
    get: (_, key) => Reflect.get(props(), key),
    has: (_, key) => Reflect.has(props(), key),
    ownKeys: () => Reflect.ownKeys(props()),
    getOwnPropertyDescriptor: (_, key) => ({
      configurable: true,
      enumerable: true,
      value: Reflect.get(props(), key),
    }),
  });
}

export function useDerivedValue<T>(value: () => T): { readonly value: T } {
  return {
    get value() {
      return value();
    },
  };
}

export function useFrameCallback(callback: FrameCallback): void {
  const latest = useRef(callback);
  latest.current = callback;
  useEffect(() => {
    const run: FrameCallback = (frame) => {
      latest.current(frame);
    };
    frameCallbacks.add(run);
    return () => {
      frameCallbacks.delete(run);
    };
  }, []);
}

export function useAnimatedReaction<T>(
  prepare: () => T,
  react: (now: T, before: T | null) => void,
): void {
  const reaction = useRef<Reaction>({
    prepare,
    react: react,
    last: null,
  });
  reaction.current.prepare = prepare;
  reaction.current.react = react;
  useEffect(() => {
    const live = reaction.current;
    reactions.add(live);
    return () => {
      reactions.delete(live);
    };
  }, []);
}

export function scheduleOnRN<A extends unknown[]>(
  callback: (...args: A) => void,
  ...args: A
): void {
  jsHops.count++;
  callback(...args);
}

export function scheduleOnUI<A extends unknown[]>(
  worklet: (...args: A) => void,
  ...args: A
): void {
  worklet(...args);
}

export const cancelAnimation = (): undefined => undefined;

const uiFrameNow = (frame: FrameRequestCallback): number => {
  frame(timestamp);
  return 0;
};

const RAF = 'requestAnimationFrame';
let ownRaf: PropertyDescriptor | undefined;

beforeEach(() => {
  ownRaf = Object.getOwnPropertyDescriptor(globalThis, RAF);
  Object.defineProperty(globalThis, RAF, {
    value: uiFrameNow,
    configurable: true,
    writable: true,
  });
});
afterEach(() => {
  if (ownRaf === undefined) Reflect.deleteProperty(globalThis, RAF);
  else Object.defineProperty(globalThis, RAF, ownRaf);
});

export function runFrame(): void {
  timestamp += FRAME_MS;
  for (const callback of frameCallbacks) callback({ timestamp });
  for (const reaction of reactions) {
    const now = reaction.prepare();
    const before = reaction.last;
    reaction.last = now;
    reaction.react(now as never, before as never);
  }
}

const transition = {
  reduceMotion: () => transition,
  withCallback: () => transition,
};

export const FadeIn = transition;
export const SlideInDown = transition;
export const ReduceMotion = {
  System: 'system',
  Always: 'always',
  Never: 'never',
};

export function useReducedMotion(): boolean {
  return false;
}

export function withSpring<T>(value: T): T {
  return value;
}

export function withTiming<T>(
  value: T,
  _config?: unknown,
  done?: (finished: boolean) => void,
): T {
  done?.(true);
  return value;
}
