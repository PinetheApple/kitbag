import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const scroll = vi.hoisted(() => ({ enabled: false }));
const run = vi.hoisted(() => ({ deviations: [] as number[] }));
const hooks = vi.hoisted(() => ({ slots: [] as unknown[], next: 0 }));

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useMemo: <T>(make: () => T) => make(),
  useCallback: <T>(fn: T) => fn,
  useState: <T>(initial: T) => {
    const slot = hooks.next++;
    if (!(slot in hooks.slots)) hooks.slots[slot] = initial;
    const set = (next: T) => {
      hooks.slots[slot] = next;
    };
    return [hooks.slots[slot] as T, set];
  },
}));

vi.mock('react-native', () => ({
  Pressable: 'Pressable',
  ScrollView: 'ScrollView',
  Text: 'Text',
  View: 'View',
}));

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

vi.mock('@kitbag/core-design', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  AppBar: 'AppBar',
  Badge: 'Badge',
  Button: 'Button',
  createThemedStyles: (build: (theme: unknown) => unknown) => () =>
    build({ color: {} }),
  textStyle: () => ({}),
  usePlayerScroll: () => ({
    scrollEnabled: scroll.enabled,
    onLayout: () => undefined,
    onContentSizeChange: () => undefined,
  }),
}));

vi.mock('@kitbag/core-state', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useCalibration: (_session: unknown, select: (state: unknown) => unknown) =>
    select({
      phase: 'running',
      route: { id: 'speaker', name: '', kind: 'speaker', certain: true },
      deviations: run.deviations,
      outcome: null,
      notice: null,
    }),
}));

vi.mock('./useCalibrationSession.ts', () => ({
  useCalibrationSession: () => ({ getState: () => ({}) }),
}));

const { CalibrationScreen } = await import('./CalibrationScreen.tsx');

type Props = Record<string, unknown> & { readonly children?: ReactNode };
type Node = ReactElement<Props>;

interface Placed {
  readonly node: Node;
  readonly inScroll: boolean;
}

function walk(node: Node, inScroll: boolean): Placed[] {
  const here = inScroll || node.type === 'ScrollView';
  const children = [node.props.children]
    .flat(Infinity)
    .filter((child): child is Node => isValidElement(child));
  return [{ node, inScroll }].concat(
    ...children.map((child) => walk(child, here)),
  );
}

function render(): Placed[] {
  hooks.next = 0;
  return walk(CalibrationScreen({ onBack: () => undefined }) as Node, false);
}

const isTapTarget = ({ node }: Placed) =>
  typeof node.props.onPressIn === 'function' && node.props.disabled !== true;

const buttonNamed = (label: string) => (placed: Placed) =>
  placed.node.type === 'Button' && placed.node.props.label === label;

beforeEach(() => {
  hooks.slots = [];
  run.deviations = [];
});

const tapsInScroll = (tree: Placed[]) =>
  tree.filter(isTapTarget).some((placed) => placed.inScroll);

describe('calibration screen on a short window', () => {
  beforeEach(() => {
    scroll.enabled = true;
  });

  it('puts the actions and the route caption in a scroll region', () => {
    const tree = render();
    expect(tree.find(buttonNamed('Start over'))?.inScroll).toBe(true);
    const caption = tree.find(
      ({ node }) =>
        node.type === 'Text' &&
        typeof node.props.children === 'string' &&
        node.props.children.startsWith('Saved for'),
    );
    expect(caption?.inScroll).toBe(true);
  });

  it('keeps every live tap target out of the scroll region', () => {
    const targets = render().filter(isTapTarget);
    expect(targets.length).toBeGreaterThan(0);
    expect(targets.every((placed) => !placed.inScroll)).toBe(true);
  });
});

describe('calibration screen when everything fits', () => {
  beforeEach(() => {
    scroll.enabled = false;
  });

  it('lets a tap below the prompt count while nothing scrolls', () => {
    const tree = render();
    const region = tree.find(({ node }) => node.type === 'ScrollView');
    expect(region?.node.props.scrollEnabled).toBe(false);
    expect(tapsInScroll(tree)).toBe(true);
  });

  it('keeps taps below the prompt counting when the region overflows mid-run', () => {
    render();
    run.deviations = [12, 15, 9];
    scroll.enabled = true;
    expect(tapsInScroll(render())).toBe(true);
  });

  it('lets the next run see that the region now scrolls', () => {
    render();
    run.deviations = [12, 15, 9];
    scroll.enabled = true;
    render();
    run.deviations = [];
    expect(tapsInScroll(render())).toBe(false);
  });
});
