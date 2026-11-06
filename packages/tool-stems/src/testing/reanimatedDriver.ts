import { useEffect, useRef } from 'react';

type FrameCallback = (frame: { readonly timestamp: number }) => void;

interface Reaction {
  prepare: () => unknown;
  react: (now: never, before: never) => void;
  last: unknown;
}

const frameCallbacks = new Set<FrameCallback>();
const reactions = new Set<Reaction>();
const FRAME_MS = 16;
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

export function useAnimatedStyle<T>(style: () => T): T {
  return style();
}

export function useAnimatedProps<T>(props: () => T): T {
  return props();
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
  callback(...args);
}

export function runFrame(): void {
  timestamp += FRAME_MS;
  for (const callback of frameCallbacks) callback({ timestamp });
  for (const reaction of reactions) {
    const now = reaction.prepare();
    if (now !== reaction.last) {
      const before = reaction.last;
      reaction.last = now;
      reaction.react(now as never, before as never);
    }
  }
}

const transition = { reduceMotion: () => transition };

export const FadeIn = transition;
export const FadeOut = transition;
export const SlideInDown = transition;
export const SlideOutDown = transition;
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

export function withTiming<T>(value: T): T {
  return value;
}

export function runOnJS<T>(callback: T): T {
  return callback;
}
