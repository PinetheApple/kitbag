import type { ReactElement, ReactNode } from 'react';
import { expect, it, vi } from 'vitest';

const DRAG = { drag: true };
const transition = (name: string) => ({ reduceMotion: () => name });
const portal = { show: vi.fn(), hide: vi.fn() };
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

function child(element: ReactElement<Props>, index: number) {
  const kids = element.props.children;
  return (Array.isArray(kids) ? kids : [kids])[index] as ReactElement<Props>;
}

it('keeps the slide animation off the view that carries the drag transform', () => {
  Sheet({
    visible: true,
    title: 'T',
    dismissLabel: 'Close',
    onDismiss: vi.fn(),
    children: null,
  });
  const frame = portal.show.mock.calls[0]?.[1] as ReactElement<Props>;
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
