import { createElement, type ReactElement, type ReactNode } from 'react';
import type { HostInstance } from 'react-native';
import { expect, it, vi } from 'vitest';

import type { ThemeMode } from '../tokens.ts';

const WINDOW_HEIGHT = 800;
const DRAG_DISTANCE = 40;
interface Motion {
  readonly settles: ((finished: boolean) => void)[];
  pan: { onUpdate?: (event: { translationY: number }) => void };
}
const motion = vi.hoisted((): Motion => ({ settles: [], pan: {} }));
const STATUS_BAR = 24;
const portal = { show: vi.fn(), hide: vi.fn(), topInset: STATUS_BAR };
const back = vi.hoisted(() => ({ handlers: [] as (() => void)[] }));
const focusReaderOn = vi.hoisted(() => vi.fn());
const platform = vi.hoisted(() => ({ OS: 'android' }));
const display = vi.hoisted(() => ({ fontScale: 1 }));
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
  useWindowDimensions: () => ({
    height: WINDOW_HEIGHT,
    fontScale: display.fontScale,
  }),
}));
vi.mock('react-native-reanimated', () => {
  interface Timing {
    readonly to: number;
    readonly done?: (finished: boolean) => void;
  }
  const isTiming = (next: unknown): next is Timing =>
    typeof next === 'object' && next !== null && 'to' in next;
  function useSharedValue(initial: unknown) {
    let current = initial;
    return {
      get value() {
        return current;
      },
      set value(next: unknown) {
        if (!isTiming(next)) {
          current = next;
          return;
        }
        const { to, done } = next;
        if (done === undefined) {
          current = to;
          return;
        }
        motion.settles.push((finished) => {
          if (finished) current = to;
          done(finished);
        });
      },
    };
  }
  return {
    default: { View: 'Animated.View' },
    cancelAnimation: vi.fn(),
    useAnimatedStyle: (updater: () => unknown) => ({ animated: updater }),
    useSharedValue,
    withSpring: vi.fn(),
    withTiming: (
      to: number,
      _config: unknown,
      done?: (finished: boolean) => void,
    ) => ({ to, done }),
  };
});
vi.mock('react-native-gesture-handler', () => ({
  usePanGesture: (config: typeof motion.pan) => {
    motion.pan = config;
    return {};
  },
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
  style?: unknown;
  contentContainerStyle?: unknown;
  persistentScrollbar?: boolean;
  children?: ReactNode;
}>;

function flat(style: unknown): Record<string, unknown> {
  const parts: unknown[] = [style].flat(Infinity).filter(Boolean);
  return Object.assign({}, ...parts) as Record<string, unknown>;
}

function translateY(style: unknown): number | undefined {
  const parts: unknown[] = [style].flat(Infinity).filter(Boolean);
  const moved = parts.flatMap((part) =>
    typeof part === 'object' && part !== null && 'animated' in part
      ? [(part as { animated: () => { transform?: unknown } }).animated()]
      : [],
  );
  const transforms = moved.flatMap(({ transform }) =>
    Array.isArray(transform) ? (transform as unknown[]) : [],
  ) as { translateY: number }[];
  return transforms[0]?.translateY;
}

function openSheet(
  onDismiss = vi.fn(),
  title = 'T',
  notice?: ReactNode,
  onShown?: () => void,
) {
  portal.show.mockClear();
  motion.settles.length = 0;
  Sheet({
    visible: true,
    title,
    dismissLabel: `Close ${title}`,
    onDismiss,
    notice,
    ...(onShown === undefined ? {} : { onShown }),
    children: null,
  });
  return portal.show.mock.calls[0]?.[1] as ReactElement<Props>;
}

function settleEnter(finished: boolean) {
  const [settle] = motion.settles.splice(0);
  if (settle === undefined) throw new Error('no enter started');
  settle(finished);
}

function hasEntering(node: unknown): boolean {
  if (Array.isArray(node)) return node.some(hasEntering);
  if (node === null || typeof node !== 'object' || !('props' in node))
    return false;
  const { props } = node as { props: Record<string, unknown> };
  return 'entering' in props || hasEntering(props.children);
}

function child(element: ReactElement<Props>, index: number) {
  const kids = element.props.children;
  return (Array.isArray(kids) ? kids : [kids])[index] as ReactElement<Props>;
}

const LONG_TITLE = 'Trust this StemDeck server';

function titleRow(fontScale: number) {
  display.fontScale = fontScale;
  portal.show.mockClear();
  Sheet({
    visible: true,
    title: LONG_TITLE,
    titleIcon: 'trusted',
    titleDetail: '1 up next',
    titleAction: createElement('Chip'),
    dismissLabel: 'Close',
    onDismiss: vi.fn(),
    children: null,
  });
  display.fontScale = 1;
  const frame = portal.show.mock.calls[0]?.[1] as ReactElement<Props>;
  const header = child(child(child(child(frame, 1), 1), 0), 0);
  const row = child(header, 1);
  const group = child(row, 0);
  const [icon, title] = [child(group, 0), child(group, 1)];
  return {
    row: flat(row.props.style),
    group: flat(group.props.style),
    icon: icon.type,
    title: { text: title.props.children, style: flat(title.props.style) },
  };
}

it('wraps the title row at scaled text rather than breaking the title mid-word', () => {
  const { row, group, title } = titleRow(2);
  expect(row.flexWrap).toBe('wrap');
  expect(group.flexShrink ?? 0).toBe(0);
  expect(title.style.flexShrink ?? 0).toBe(0);
});

it('keeps the title icon on the line of its title when the row wraps', () => {
  const { group, icon, title } = titleRow(2);
  expect(icon).toBe('InlineIcon');
  expect(title.text).toBe(LONG_TITLE);
  expect(group.flexDirection).toBe('row');
  expect(group.flexWrap).toBeUndefined();
});

it('keeps one shrinking title line beside its action at the default size', () => {
  const { row, group, title } = titleRow(1);
  expect(row.flexWrap).toBeUndefined();
  expect(group.flexShrink).toBe(1);
  expect(title.style.flexShrink).toBe(1);
});

it('slides its card up from a window height below by its own value, not a layout animation', () => {
  const frame = openSheet();
  const slot = child(frame, 1);
  expect(hasEntering(frame)).toBe(false);
  expect(translateY(slot.props.style)).toBe(WINDOW_HEIGHT);
  settleEnter(true);
  expect(translateY(slot.props.style)).toBe(0);
});

it('settles the card in place when its slide is interrupted', () => {
  focusReaderOn.mockClear();
  const onShown = vi.fn();
  const slot = child(openSheet(vi.fn(), 'T', undefined, onShown), 1);
  settleEnter(false);
  expect(translateY(slot.props.style)).toBe(0);
  expect(onShown).not.toHaveBeenCalled();
  expect(focusReaderOn).not.toHaveBeenCalled();
});

it('reports itself shown only once its card has arrived', () => {
  const onShown = vi.fn();
  openSheet(vi.fn(), 'T', undefined, onShown);
  expect(onShown).not.toHaveBeenCalled();
  settleEnter(true);
  expect(onShown).toHaveBeenCalledOnce();
});

it('drags the card, not the slot that slides it in', () => {
  const slot = child(openSheet(), 1);
  settleEnter(true);
  motion.pan.onUpdate?.({ translationY: DRAG_DISTANCE });
  expect(translateY(slot.props.style)).toBe(0);
  expect(translateY(child(slot, 1).props.style)).toBe(DRAG_DISTANCE);
});

it('draws the notice in the portal above the sheet, sliding with its drag', () => {
  const notice = createElement('Notice');
  const slot = child(openSheet(vi.fn(), 'T', notice), 1);
  const [noticeView, sheet] = [child(slot, 0), child(slot, 1)];
  expect(child(noticeView, 0)).toBe(notice);
  motion.pan.onUpdate?.({ translationY: DRAG_DISTANCE });
  expect(translateY(noticeView.props.style)).toBe(DRAG_DISTANCE);
  expect(translateY(sheet.props.style)).toBe(DRAG_DISTANCE);
  expect(child(openSheet(), 1).props.children).toContain(null);
});

it('keeps its scroll bar drawn so content below the fold is cued at rest', () => {
  const sheet = child(child(openSheet(), 1), 1);
  const scroll = child(child(sheet, 1), 0);
  expect(scroll.props.persistentScrollbar).toBe(true);
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

const SIDES = [
  { side: 'Top', axis: 'Vertical' },
  { side: 'Bottom', axis: 'Vertical' },
  { side: 'Left', axis: 'Horizontal' },
  { side: 'Right', axis: 'Horizontal' },
] as const;

function inset(
  style: Record<string, unknown>,
  prop: 'margin' | 'padding',
  { side, axis }: (typeof SIDES)[number],
) {
  return Number(style[prop + side] ?? style[prop + axis] ?? style[prop] ?? 0);
}

it.each(SIDES)(
  'insets the content by as much as the scroll frame reaches out on the $side',
  (edge) => {
    const sheet = child(child(openSheet(), 1), 1);
    const scrollFrame = child(sheet, 1);
    const scroll = child(scrollFrame, 0);
    const reach = -inset(flat(scrollFrame.props.style), 'margin', edge);
    expect(reach).toBeGreaterThan(0);
    expect(
      inset(flat(scroll.props.contentContainerStyle), 'padding', edge),
    ).toBe(reach);
  },
);

async function titleGapStyle(os: string, mode: ThemeMode) {
  const { SHEET_TOUCH_ROOM } = await import('../sheetRoom.ts');
  platform.OS = os;
  shown.mode = mode;
  const sheet = child(child(openSheet(), 1), 1);
  platform.OS = 'android';
  shown.mode = 'dark';
  const scrollFrame = child(sheet, 1);
  const [scroll, cover] = [child(scrollFrame, 0), child(scrollFrame, 1)];
  expect(
    inset(flat(scrollFrame.props.style), 'margin', {
      side: 'Top',
      axis: 'Vertical',
    }),
  ).toBe(-SHEET_TOUCH_ROOM);
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

it('moves screen reader focus to its title once it has slid in', () => {
  focusReaderOn.mockClear();
  const [title] = headers(openSheet());
  const node = {};
  (title?.props.ref as { current: unknown }).current = node;
  expect(title?.props.children).toBe('T');
  expect(focusReaderOn).not.toHaveBeenCalled();
  settleEnter(true);
  expect(focusReaderOn).toHaveBeenCalledOnce();
  expect(focusReaderOn).toHaveBeenCalledWith(node);
});

it('moves screen reader focus to the node it was asked to start on', () => {
  focusReaderOn.mockClear();
  portal.show.mockClear();
  motion.settles.length = 0;
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
  settleEnter(true);
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
