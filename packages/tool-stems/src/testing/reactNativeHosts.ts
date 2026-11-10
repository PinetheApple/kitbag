import { act } from 'react';

function flatten(style: unknown): Record<string, unknown> {
  if (Array.isArray(style))
    return Object.assign({}, ...style.map((part) => flatten(part))) as Record<
      string,
      unknown
    >;
  return style !== null && typeof style === 'object'
    ? (style as Record<string, unknown>)
    : {};
}

export const StyleSheet = {
  create: <T>(styles: T): T => styles,
  flatten,
  absoluteFill: {},
  absoluteFillObject: {},
  hairlineWidth: 1,
};

export const View = 'View';
export const Text = 'Text';
export const TextInput = 'TextInput';
export const Pressable = 'Pressable';
export const ScrollView = 'ScrollView';
export const Modal = 'Modal';
export const Platform = { OS: 'test', select: () => undefined };

export const display = { fontScale: 1 };

export function useWindowDimensions() {
  return { width: 411, height: 891, scale: 3, fontScale: display.fontScale };
}

const backHandlers: (() => boolean)[] = [];

export const BackHandler = {
  addEventListener: (_: string, handler: () => boolean) => {
    backHandlers.push(handler);
    return {
      remove: () => {
        backHandlers.splice(backHandlers.indexOf(handler), 1);
      },
    };
  },
};

export function pressHardwareBack(): boolean {
  let handled = false;
  act(() => {
    handled = [...backHandlers].reverse().some((handler) => handler());
  });
  return handled;
}

const noSubscription = { remove: () => undefined };

export const AppState = {
  currentState: 'active',
  addEventListener: () => noSubscription,
};

export interface AccessibilityEvent {
  readonly handle: unknown;
  readonly type: string;
}

const accessibilityEvents: AccessibilityEvent[] = [];

export const AccessibilityInfo = {
  addEventListener: () => noSubscription,
  isReduceMotionEnabled: () => Promise.resolve(false),
  isScreenReaderEnabled: () => Promise.resolve(false),
  sendAccessibilityEvent: (handle: unknown, type: string) => {
    accessibilityEvents.push({ handle, type });
  },
};

export function takeAccessibilityEvents(): AccessibilityEvent[] {
  return accessibilityEvents.splice(0);
}

export const TurboModuleRegistry = {
  getEnforcing: (): never => {
    throw new Error('TurboModuleRegistry is unavailable under vitest');
  },
};
