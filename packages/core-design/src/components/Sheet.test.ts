import type { ReactElement, ReactNode } from 'react';
import { expect, it, vi } from 'vitest';

const DRAG = { drag: true };
const transition = (name: string) => ({ reduceMotion: () => name });
const STATUS_BAR = 24;
const portal = { show: vi.fn(), hide: vi.fn(), topInset: STATUS_BAR };
const chain = {
  activeOffsetY: () => chain,
  onUpdate: () => chain,
  onEnd: () => chain,
};

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useCallback: <T>(fn: T) => fn,
  useMemo: <T>(factory: () => T) => factory(),
  useId: () => 'sheet',
  useEffect: (effect: () => void) => {
    effect();
  },
}));
vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  Text: 'Text',
  View: 'View',
  StyleSheet: { create: <T>(styles: T) => styles, absoluteFill: {} },
}));
vi.mock('react-native-reanimated', () => ({
  default: { View: 'Animated.View' },
  FadeIn: transition('scrimIn'),
  FadeOut: transition('scrimOut'),
  SlideInDown: transition('sheetIn'),
  SlideOutDown: transition('sheetOut'),
  useAnimatedStyle: () => DRAG,
  useSharedValue: (value: number) => ({ value }),
  withSpring: vi.fn(),
}));
vi.mock('react-native-gesture-handler', () => ({
  Gesture: { Pan: () => chain },
  GestureDetector: 'GestureDetector',
}));
vi.mock('react-native-keyboard-controller', () => ({
  useReanimatedKeyboardAnimation: () => ({ height: { value: 0 } }),
}));
vi.mock('react-native-worklets', () => ({ scheduleOnRN: vi.fn() }));
vi.mock('./IconGlyph.tsx', () => ({ InlineIcon: 'InlineIcon' }));
vi.mock('./hardwareBack', () => ({ onHardwareBack: () => () => undefined }));
vi.mock('./SheetHost.tsx', () => ({ useSheetPortal: () => portal }));
vi.mock('../useReduceMotion.ts', () => ({
  useReduceMotionMode: () => 'system',
}));
vi.mock('../ThemeProvider.tsx', async () => {
  const { themes } = await import('../theme.ts');
  return {
    createThemedStyles:
      <T>(factory: (theme: typeof themes.dark) => T) =>
      () =>
        factory(themes.dark),
  };
});

const { Sheet } = await import('./Sheet.tsx');

type Props = Readonly<{
  entering?: unknown;
  exiting?: unknown;
  style?: unknown;
  children?: ReactNode;
}>;

function flat(style: unknown): Record<string, unknown> {
  const parts: unknown[] = [style].flat(Infinity).filter(Boolean);
  return Object.assign({}, ...parts) as Record<string, unknown>;
}

function openSheet() {
  portal.show.mockClear();
  Sheet({
    visible: true,
    title: 'T',
    dismissLabel: 'Close',
    onDismiss: vi.fn(),
    children: null,
  });
  return portal.show.mock.calls[0]?.[1] as ReactElement<Props>;
}

function child(element: ReactElement<Props>, index: number) {
  const kids = element.props.children;
  return (Array.isArray(kids) ? kids : [kids])[index] as ReactElement<Props>;
}

it('keeps the slide animation off the view that carries the drag transform', () => {
  const frame = openSheet();
  const outer = child(frame, 1);
  const inner = child(outer, 0);
  expect(outer.props).toMatchObject({
    entering: 'sheetIn',
    exiting: 'sheetOut',
  });
  expect([outer.props.style].flat()).not.toContain(DRAG);
  expect(inner.props.entering).toBeUndefined();
  expect([inner.props.style].flat()).toContain(DRAG);
});

it('caps the sheet below the status bar so tall content scrolls inside it', () => {
  const frame = openSheet();
  const slot = flat(child(frame, 1).props.style);
  expect(flat(frame.props.style)).toMatchObject({
    flex: 1,
    justifyContent: 'flex-end',
  });
  expect(slot.flexShrink).toBe(1);
  expect(slot.marginTop).toBe(STATUS_BAR);
});
