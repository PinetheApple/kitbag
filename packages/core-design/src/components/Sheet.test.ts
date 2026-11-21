import { createElement, type ReactElement, type ReactNode } from 'react';
import type { HostInstance } from 'react-native';
import { expect, it, vi } from 'vitest';

import type { ThemeMode } from '../tokens.ts';

const DRAG = { drag: true };
const entered = vi.hoisted(() => ({
  settle: undefined as ((finished: boolean) => void) | undefined,
}));
const settlingTransition = (name: string) => ({
  reduceMotion: () => ({
    withCallback: (settle: (finished: boolean) => void) => {
      entered.settle = settle;
      return name;
    },
  }),
});
const STATUS_BAR = 24;
const portal = { show: vi.fn(), hide: vi.fn(), topInset: STATUS_BAR };
const back = vi.hoisted(() => ({ handlers: [] as (() => void)[] }));
const focusReaderOn = vi.hoisted(() => vi.fn());
const platform = vi.hoisted(() => ({ OS: 'android' }));
const shown = vi.hoisted((): { mode: ThemeMode } => ({ mode: 'dark' }));
const SURFACE1 = { dark: '#1A1820', light: '#FFFFFF' } as const;
const SURFACE1_CLEAR = { dark: '#1A182000', light: '#FFFFFF00' } as const;
const THEME_MODES = ['dark', 'light'] as const;

vi.mock('react', async (importOriginal) => ({
  ...(await importOriginal<typeof import('react')>()),
  useCallback: <T>(fn: T) => fn,
  useMemo: <T>(factory: () => T) => factory(),
  useId: () => 'sheet',
  useRef: <T>(current: T) => ({ current }),
  useEffect: (effect: () => void) => {
    effect();
  },
}));
vi.mock('react-native', () => ({
  Platform: platform,
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  Text: 'Text',
  View: 'View',
  StyleSheet: { create: <T>(styles: T) => styles, absoluteFill: {} },
  useWindowDimensions: () => ({ height: 0 }),
}));
vi.mock('react-native-reanimated', () => ({
  default: { View: 'Animated.View' },
  SlideInDown: settlingTransition('sheetIn'),
  useAnimatedStyle: () => DRAG,
  useSharedValue: (value: number) => ({ value }),
  withSpring: vi.fn(),
  withTiming: vi.fn(),
}));
vi.mock('react-native-gesture-handler', () => ({
  usePanGesture: () => ({}),
  GestureDetector: 'GestureDetector',
}));
vi.mock('react-native-keyboard-controller', () => ({
  useReanimatedKeyboardAnimation: () => ({ height: { value: 0 } }),
}));
vi.mock('react-native-worklets', () => ({
  scheduleOnRN: (fn: () => void) => {
    fn();
  },
}));
vi.mock('./IconGlyph.tsx', () => ({ InlineIcon: 'InlineIcon' }));
vi.mock('./hardwareBack', () => ({
  onHardwareBack: (handler: () => void) => {
    back.handlers.push(handler);
    return () => undefined;
  },
}));
vi.mock('../readerFocus', () => ({ focusReaderOn }));
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
        factory(themes[shown.mode]),
  };
});

const { Sheet } = await import('./Sheet.tsx');

type Props = Readonly<{
  accessibilityRole?: string;
  accessibilityLabel?: string;
  accessibilityActions?: readonly { name: string; label?: string }[];
  importantForAccessibility?: string;
  accessibilityElementsHidden?: boolean;
  onAccessibilityEscape?: () => void;
  onAccessibilityAction?: (event: {
    nativeEvent: { actionName: string };
  }) => void;
  ref?: unknown;
  entering?: unknown;
  style?: unknown;
  children?: ReactNode;
}>;

function flat(style: unknown): Record<string, unknown> {
  const parts: unknown[] = [style].flat(Infinity).filter(Boolean);
  return Object.assign({}, ...parts) as Record<string, unknown>;
}

function openSheet(onDismiss = vi.fn(), title = 'T', notice?: ReactNode) {
  portal.show.mockClear();
  Sheet({
    visible: true,
    title,
    dismissLabel: `Close ${title}`,
    onDismiss,
    notice,
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
  const inner = child(outer, 1);
  expect(outer.props.entering).toBe('sheetIn');
  expect([outer.props.style].flat()).not.toContain(DRAG);
  expect(inner.props.entering).toBeUndefined();
  expect([inner.props.style].flat()).toContain(DRAG);
});

it('draws the notice in the portal above the sheet, sliding with its drag', () => {
  const notice = createElement('Notice');
  const slot = child(openSheet(vi.fn(), 'T', notice), 1);
  const [noticeView, sheet] = [child(slot, 0), child(slot, 1)];
  expect(child(noticeView, 0)).toBe(notice);
  expect([noticeView.props.style].flat()).toContain(DRAG);
  expect([sheet.props.style].flat()).toContain(DRAG);
  expect(child(openSheet(), 1).props.children).toContain(null);
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

async function titleGapStyle(os: string, mode: ThemeMode) {
  const { SHEET_TOUCH_ROOM } = await import('./Sheet.tsx');
  platform.OS = os;
  shown.mode = mode;
  const sheet = child(child(openSheet(), 1), 1);
  platform.OS = 'android';
  shown.mode = 'dark';
  const scrollFrame = child(sheet, 1);
  const [scroll, cover] = [child(scrollFrame, 0), child(scrollFrame, 1)];
  expect(flat(scrollFrame.props.style).marginVertical).toBe(-SHEET_TOUCH_ROOM);
  expect(scroll.type).toBe('ScrollView');
  const style = flat(cover.props.style);
  expect(style).toMatchObject({
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: SHEET_TOUCH_ROOM,
    pointerEvents: 'none',
  });
  return style;
}

it.each(THEME_MODES)(
  'fades scrolled content out under the title on native in %s',
  async (mode) => {
    const style = await titleGapStyle('android', mode);
    expect(style.experimental_backgroundImage).toBe(
      `linear-gradient(to bottom, ${SURFACE1[mode]}, ${SURFACE1_CLEAR[mode]})`,
    );
    expect(style.backgroundColor).toBeUndefined();
  },
);

it.each(THEME_MODES)(
  'covers the title gap solid on web, which drops background images, in %s',
  async (mode) => {
    const style = await titleGapStyle('web', mode);
    expect(style.backgroundColor).toBe(SURFACE1[mode]);
    expect(style.experimental_backgroundImage).toBeUndefined();
  },
);

function headers(node: unknown): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(headers);
  if (node === null || typeof node !== 'object' || !('props' in node))
    return [];
  const element = node as ReactElement<Props>;
  const here = element.props.accessibilityRole === 'header' ? [element] : [];
  return [...here, ...headers(element.props.children)];
}

function settleEntering(finished: boolean) {
  if (entered.settle === undefined) throw new Error('no entering callback');
  entered.settle(finished);
}

it('moves screen reader focus to its title once it has slid in', () => {
  focusReaderOn.mockClear();
  const [title] = headers(openSheet());
  const node = {};
  (title?.props.ref as { current: unknown }).current = node;
  expect(title?.props.children).toBe('T');
  expect(focusReaderOn).not.toHaveBeenCalled();
  settleEntering(false);
  expect(focusReaderOn).not.toHaveBeenCalled();
  settleEntering(true);
  expect(focusReaderOn).toHaveBeenCalledOnce();
  expect(focusReaderOn).toHaveBeenCalledWith(node);
});

it('moves screen reader focus to the node it was asked to start on', () => {
  focusReaderOn.mockClear();
  portal.show.mockClear();
  const start = { node: 'rate heading' };
  Sheet({
    visible: true,
    title: 'T',
    dismissLabel: 'Close T',
    onDismiss: vi.fn(),
    initialFocusRef: { current: start as unknown as HostInstance },
    children: null,
  });
  const [title] = headers(portal.show.mock.calls[0]?.[1]);
  (title?.props.ref as { current: unknown }).current = { node: 'title' };
  settleEntering(true);
  expect(focusReaderOn).toHaveBeenCalledOnce();
  expect(focusReaderOn.mock.calls[0]?.[0]).toBe(start);
});

function readerOrder(node: unknown): ReactElement<Props>[] {
  if (Array.isArray(node)) return node.flatMap(readerOrder);
  if (node === null || typeof node !== 'object' || !('props' in node))
    return [];
  const element = node as ReactElement<Props>;
  const { props } = element;
  if (props.importantForAccessibility === 'no-hide-descendants') return [];
  const reachable =
    element.type === 'Pressable' ||
    element.type === 'Text' ||
    props.accessibilityLabel !== undefined;
  return [...(reachable ? [element] : []), ...readerOrder(props.children)];
}

it('puts its title, not its backdrop, first for a screen reader', () => {
  const [first] = readerOrder(openSheet(vi.fn(), 'Top'));
  expect(first?.props.accessibilityRole).toBe('header');
  expect(first?.props.children).toBe('Top');
});

it('offers closing as a screen reader action on the title', () => {
  const onDismiss = vi.fn();
  const [title] = headers(openSheet(onDismiss, 'Top'));
  expect(title?.props.accessibilityActions).toEqual([
    { name: 'dismiss', label: 'Close Top' },
  ]);
  title?.props.onAccessibilityAction?.({
    nativeEvent: { actionName: 'activate' },
  });
  expect(onDismiss).not.toHaveBeenCalled();
  title?.props.onAccessibilityAction?.({
    nativeEvent: { actionName: 'dismiss' },
  });
  expect(onDismiss).toHaveBeenCalledOnce();
});

it('closes on the screen reader escape gesture anywhere in the sheet', () => {
  const onDismiss = vi.fn();
  const frame = openSheet(onDismiss);
  expect(frame.props.onAccessibilityEscape).toBe(onDismiss);
});

it('closes on hardware Back', () => {
  back.handlers.length = 0;
  const onDismiss = vi.fn();
  openSheet(onDismiss);
  back.handlers.forEach((handler) => {
    handler();
  });
  expect(onDismiss).toHaveBeenCalledOnce();
});
