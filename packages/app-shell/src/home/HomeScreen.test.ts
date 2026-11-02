import { space } from '@kitbag/core-design';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeAll, describe, expect, it, vi } from 'vitest';

type Style = Record<string, unknown>;
type StyleProp = Style | false | null | undefined | readonly StyleProp[];
type Props = Record<string, unknown> & { readonly children?: ReactNode };

const STATUS_BAR = 24;
const NAV_BAR = 16;
const BG = 'screen-bg';

interface Rendered {
  readonly kind: 'View' | 'ScrollView';
  readonly props: Props;
}

const rendered = vi.hoisted(() => [] as Rendered[]);

const storeState = vi.hoisted(() => ({
  bpm: 120,
  beatsPerBar: 4,
  denominator: 4,
  running: false,
  ramp: { enabled: false, startBpm: 120, targetBpm: 120 },
  tuning: undefined,
  rows: [],
  failed: false,
  toolId: undefined,
  arrangement: undefined,
  arrange: () => undefined,
  off: [],
}));

vi.mock('react-native', async () => {
  const { createElement: h } = await import('react');
  return {
    View: (props: Props) => {
      rendered.push({ kind: 'View', props });
      return h('div', null, props.children);
    },
    ScrollView: (props: Props) => {
      rendered.push({ kind: 'ScrollView', props });
      return h('div', null, props.children);
    },
  };
});

vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({
    top: STATUS_BAR,
    bottom: NAV_BAR,
    left: 0,
    right: 0,
  }),
}));

vi.mock('@kitbag/core-design', async (original) => {
  const pure = await original<Record<string, unknown>>();
  return {
    ...pure,
    AppBar: () => null,
    AppBarAction: () => null,
    Button: () => null,
    ToolGrid: () => null,
    ToolRow: () => null,
    createThemedStyles:
      (factory: (theme: unknown) => Record<string, Style>) => () =>
        factory({ color: { bg: BG } }),
  };
});

vi.mock('@kitbag/core-state', async (original) => {
  const useStore = <T>(selector: (state: typeof storeState) => T) =>
    selector(storeState);
  return {
    ...(await original<Record<string, unknown>>()),
    useHomeLayout: useStore,
    useLastTool: useStore,
    useMetronome: useStore,
    useSongLibrary: useStore,
    useTools: useStore,
    useTuner: useStore,
  };
});

vi.mock('@kitbag/tool-tuner', () => ({
  DEFAULT_TUNING: {},
  tuningLabel: () => 'Standard',
}));

vi.mock('expo-router', () => ({
  useRouter: () => ({ push: () => undefined }),
}));

vi.mock('./ArrangeSheet.tsx', () => ({ ArrangeSheet: () => null }));
vi.mock('./MoreToolsRow.tsx', () => ({ MoreToolsRow: () => null }));

const { HomeScreen } = await import('./HomeScreen.tsx');

function flatten(style: StyleProp): Style {
  if (Array.isArray(style)) {
    return (style as readonly StyleProp[]).reduce<Style>(
      (merged, s) => ({ ...merged, ...flatten(s) }),
      {},
    );
  }
  return style ? (style as Style) : {};
}

function scrollView(): Rendered {
  const found = rendered.find((r) => r.kind === 'ScrollView');
  if (found === undefined) throw new Error('no ScrollView rendered');
  return found;
}

function contentStyle(): Style {
  return flatten(scrollView().props.contentContainerStyle as StyleProp);
}

beforeAll(() => {
  rendered.length = 0;
  renderToStaticMarkup(createElement(HomeScreen));
});

describe('HomeScreen safe-area insets', () => {
  it('keeps the status bar inset out of the scrolling content', () => {
    expect(contentStyle().paddingTop).toBe(space.screenInset);
  });

  it('pads the status bar on a non-scrolling container painted with the screen background', () => {
    const scrollIndex = rendered.indexOf(scrollView());
    const frame = rendered
      .slice(0, scrollIndex)
      .map((r) => flatten(r.props.style as StyleProp))
      .find((s) => s.paddingTop === STATUS_BAR);
    expect(frame?.backgroundColor).toBe(BG);
  });

  it('keeps the navigation bar inset at the end of the scrolling content', () => {
    expect(contentStyle().paddingBottom).toBe(space.screenInset + NAV_BAR);
  });
});
