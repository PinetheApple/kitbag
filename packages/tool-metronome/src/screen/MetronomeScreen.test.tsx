// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act, createElement, type ElementType, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { View } from 'react-native';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { metronome } from '@kitbag/core-design';

import {
  pinnedStackScrollSlack,
  pinnedViewportOverlap,
} from '../logic/belowTempo.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

type Style = Readonly<Record<string, unknown>>;

const flatStyle = vi.hoisted(
  () =>
    (style: unknown): Style =>
      Object.assign({}, ...[style].flat(Infinity)) as Style,
);
const display = vi.hoisted(() => ({
  fontScale: 1,
  running: false,
  hintSeen: true,
  runRows: 2,
  windowHeight: 800,
}));
const INITIAL_DISPLAY = { ...display };
const hint = vi.hoisted(() => ({ props: null as Props | null }));
const scroll = vi.hoisted(() => ({ props: null as Props | null }));
const zone = vi.hoisted(() => ({ props: null as Props | null }));
const swipes = vi.hoisted(() => [] as { readonly enabled: boolean }[]);

vi.mock('./EndedSetlistSnackbar.tsx', () => ({
  EndedSetlistSnackbar: () => null,
}));
vi.mock('react-native', async () => {
  const { createElement: h } = await import('react');
  return {
    View: (props: Props) =>
      h(
        'div',
        { 'data-overflow': flatStyle(props.style).overflow },
        props.children,
      ),
    Text: (props: Props) => h('div', null, props.children),
    useWindowDimensions: () => ({
      width: 360,
      height: display.windowHeight,
      fontScale: display.fontScale,
    }),
  };
});

vi.mock('react-native-gesture-handler', async () => {
  const { createElement: h } = await import('react');
  return {
    GestureDetector: (props: Props) => h('div', null, props.children),
    ScrollView: (props: Props) => {
      scroll.props = props;
      return h('div', { 'data-scroll': true }, props.children);
    },
  };
});

vi.mock('@kitbag/core-design', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  createThemedStyles: (build: (theme: unknown) => unknown) => () =>
    build({ color: {} }),
  textRoles: {},
  textStyle: () => ({}),
  fadeToClear: () => ({}),
}));

vi.mock('@kitbag/core-state', () => ({
  BPM_BOUNDS: { min: 20, max: 300 },
  getPracticeSessionStore: () => ({ getState: () => ({ pending: [] }) }),
  useLibrary: (select: (state: unknown) => unknown) =>
    select({ loaded: null, presets: [] }),
  useMetronome: (select: (state: unknown) => unknown) =>
    select({ running: display.running, beatsPerBar: 4, polyEnabled: false }),
  useSwipeHint: (select: (state: unknown) => unknown) =>
    select({ seen: display.hintSeen, dismiss: () => undefined }),
}));

vi.mock('../logic/belowTempo.ts', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  belowTempoReserve: () => 0,
}));
vi.mock('../library/useLibraryRefresh.ts', () => ({
  useLibraryRefresh: () => undefined,
}));
vi.mock('./useHoldEngine.ts', () => ({ useHoldEngine: () => undefined }));
vi.mock('./useEndPracticeOnLeave.ts', () => ({
  useEndPracticeOnLeave: () => undefined,
}));
vi.mock('./useMetronomeFrame.ts', () => ({
  useMetronomeFrame: () => ({}),
}));
vi.mock('./usePracticeSettings.ts', () => ({
  usePracticeSettings: () => ({}),
}));
vi.mock('./useStatusRunRows.ts', () => ({
  useStatusRunRows: () => display.runRows,
}));
vi.mock('./useTempoSwipe.ts', () => ({
  useTempoSwipe: (
    _bpm: unknown,
    _onTempo: unknown,
    options: { readonly enabled: boolean },
  ) => {
    swipes.push(options);
    return {};
  },
}));
vi.mock('../logic/statusRows.ts', () => ({
  practiceBadgeCount: () => 0,
  restLegend: () => null,
}));
vi.mock('./PracticePill.tsx', () => ({
  PracticePill: () => null,
  usePracticeElapsed: () => ({ elapsedMs: 0, reset: () => undefined }),
}));
vi.mock('./PracticeSummarySheet.tsx', () => ({
  PracticeSummarySheet: () => null,
  usePendingPractice: () => null,
}));
vi.mock('./BeatDots.tsx', () => ({
  BeatDots: () => null,
  BeatLegend: () => null,
}));
vi.mock('./NumberEntrySheet.tsx', () => ({ NumberEntrySheet: () => null }));
vi.mock('./MeterSheet.tsx', () => ({ MeterSheet: () => null }));
vi.mock('./MetronomeAppBar.tsx', () => ({ MetronomeAppBar: () => null }));
vi.mock('./PickerChips.tsx', () => ({ PickerChips: () => null }));
vi.mock('./PolyLegend.tsx', () => ({ PolyLegend: () => null }));
vi.mock('./PracticeSheet.tsx', () => ({ PracticeSheet: () => null }));
vi.mock('./PresetRow.tsx', () => ({ PresetRow: () => null }));
vi.mock('./StatusStack.tsx', () => ({ StatusStack: () => null }));
vi.mock('./SubdivisionSheet.tsx', () => ({ SubdivisionSheet: () => null }));
vi.mock('./SwipeHint.tsx', () => ({
  SwipeHint: (props: Props) => {
    hint.props = props;
    return null;
  },
}));
vi.mock('./SwipeTempoZone.tsx', () => ({
  SwipeTempoZone: (props: Props) => {
    zone.props = props;
    return null;
  },
}));
vi.mock('./Transport.tsx', () => ({ Transport: () => null }));
vi.mock('./UnsavedSnackbar.tsx', () => ({ UnsavedSnackbar: () => null }));
vi.mock('./SongClickSnackbar.tsx', () => ({ SongClickSnackbar: () => null }));

const { MetronomeScreen } = await import('./MetronomeScreen.tsx');
const { MetronomeAppBar } = await import('./MetronomeAppBar.tsx');
const { SwipeHint } = await import('./SwipeHint.tsx');
const { Transport } = await import('./Transport.tsx');
const { SwipeTempoZone } = await import('./SwipeTempoZone.tsx');
const { PresetRow } = await import('./PresetRow.tsx');
const { BeatDots } = await import('./BeatDots.tsx');
const { ScrollView } = await import('react-native-gesture-handler');
const { UnsavedSnackbar } = await import('./UnsavedSnackbar.tsx');
const { SongClickSnackbar } = await import('./SongClickSnackbar.tsx');

const COMPACT_GAP = metronome.bodyGapCompact;

function screenElement() {
  return createElement(MetronomeScreen, { insets: { top: 0, bottom: 0 } });
}

function renderBody(fontScale: number, running: boolean): string {
  display.fontScale = fontScale;
  display.running = running;
  return renderToStaticMarkup(screenElement());
}

function layOut(view: { readonly props: Props }, y: number, height: number) {
  const onLayout = view.props.onLayout as (event: unknown) => void;
  act(() => {
    onLayout({ nativeEvent: { layout: { y, height } } });
  });
}

function scrollPadding(fontScale: number, running: boolean): unknown {
  renderBody(fontScale, running);
  return flatStyle(scroll.props?.contentContainerStyle).paddingBottom;
}

function viewportBottom(fontScale: number, running: boolean): unknown {
  renderBody(fontScale, running);
  return flatStyle(scroll.props?.style).bottom;
}

function mountScreen(): ReactTestRenderer {
  (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
  const mounted: { screen?: ReactTestRenderer } = {};
  act(() => {
    mounted.screen = create(screenElement());
  });
  if (mounted.screen === undefined) throw new Error('screen did not mount');
  return mounted.screen;
}

function laidOutViews(screen: ReactTestRenderer) {
  const block = screen.root.findByProps({ testID: 'tempo-block' });
  const zoneView = screen.root
    .findAllByType(View)
    .find((view) => view.props.onLayout !== undefined && view !== block);
  if (zoneView === undefined) throw new Error('tempo zone has no onLayout');
  return { block, zone: zoneView };
}

afterEach(() => {
  Object.assign(display, INITIAL_DISPLAY);
});

describe('MetronomeScreen scroll body', () => {
  it('pads the content by the pinned stack slack, running and stopped', () => {
    for (const running of [false, true]) {
      const slack = pinnedStackScrollSlack(running, 2, COMPACT_GAP);
      expect(slack).toBeGreaterThan(0);
      expect(scrollPadding(2, running)).toBe(slack);
    }
  });

  it('adds no padding at the default text size', () => {
    expect(scrollPadding(1, false)).toBe(0);
    expect(scrollPadding(1, true)).toBe(0);
  });

  it('extends the viewport under the stack the run reserves', () => {
    for (const runRows of [0, 1, 2]) {
      display.runRows = runRows;
      expect(viewportBottom(2, true)).toBe(
        -pinnedViewportOverlap(runRows, 2, COMPACT_GAP),
      );
    }
  });

  it('extends the viewport under the rest row while stopped', () => {
    expect(viewportBottom(2, false)).toBe(
      -pinnedViewportOverlap(1, 2, COMPACT_GAP),
    );
    expect(viewportBottom(1, true)).toBe(-0);
  });

  it('drops the gap above the transport when a running stack has no row', () => {
    const gapAbove = (runRows: number): unknown => {
      display.fontScale = 2;
      display.running = true;
      display.runRows = runRows;
      const wrapper = mountScreen().root.findByProps({
        testID: 'pinned-status',
      });
      return flatStyle(wrapper.props.style).marginTop;
    };
    expect(gapAbove(0)).toBe(0);
    expect(gapAbove(1)).toBe(COMPACT_GAP);
  });

  it('clips the extended viewport to the space above the stack', () => {
    expect(renderBody(2, true)).toContain(
      '<div data-overflow="hidden"><div data-scroll="true">',
    );
  });

  it('places the swipe hint from the tempo block it sits in', () => {
    const BLOCK_TOP = 50;
    const ZONE_TOP = 20;
    const ZONE_HEIGHT = 100;
    display.hintSeen = false;
    const views = laidOutViews(mountScreen());
    layOut(views.block, BLOCK_TOP, ZONE_HEIGHT);
    layOut(views.zone, ZONE_TOP, ZONE_HEIGHT);
    expect(hint.props?.zoneTop).toBe(BLOCK_TOP + ZONE_TOP);
  });
});

describe('MetronomeScreen swipe hint', () => {
  const ZONE_HEIGHT = 100;
  const HIDDEN = {
    importantForAccessibility: 'no-hide-descendants',
    accessibilityElementsHidden: true,
  };
  const SHOWN = {
    importantForAccessibility: 'auto',
    accessibilityElementsHidden: false,
  };

  function hintShown(): ReactTestRenderer {
    display.hintSeen = false;
    const screen = mountScreen();
    layOut(laidOutViews(screen).zone, 0, ZONE_HEIGHT);
    return screen;
  }

  function readerLayers(screen: ReactTestRenderer) {
    const layers = screen.root.findAll(
      (node) =>
        node.type === View &&
        node.props.importantForAccessibility !== undefined,
    );
    const holding = (type: ElementType) =>
      layers.find((layer) => layer.findAllByType(type).length > 0);
    const main = holding(MetronomeAppBar);
    const snackbars = holding(UnsavedSnackbar);
    if (main === undefined || snackbars === undefined)
      throw new Error('a reader layer is missing');
    return { layers, main, snackbars };
  }

  it('hides the screen behind it from screen readers', () => {
    const screen = hintShown();
    const { main, snackbars } = readerLayers(screen);
    expect(screen.root.findAllByType(SwipeHint)).toHaveLength(1);
    expect(main.findAllByType(SwipeHint)).toHaveLength(0);
    expect(main.findAllByType(Transport)).toHaveLength(1);
    expect(main.props).toMatchObject(HIDDEN);
    expect(snackbars.findAllByType(SongClickSnackbar)).toHaveLength(1);
    expect(snackbars.props).toMatchObject(HIDDEN);
  });

  it('keeps the snackbars out of the padded screen layer', () => {
    const { main, snackbars } = readerLayers(hintShown());
    expect(main.findAllByType(UnsavedSnackbar)).toHaveLength(0);
    expect(main.findAllByType(SongClickSnackbar)).toHaveLength(0);
    expect(snackbars.parent).toBe(main.parent);
  });

  it('gives the screen back to screen readers once dismissed', () => {
    const screen = hintShown();
    display.hintSeen = true;
    act(() => {
      screen.update(screenElement());
    });
    expect(screen.root.findAllByType(SwipeHint)).toHaveLength(0);
    for (const layer of readerLayers(screen).layers)
      expect(layer.props).toMatchObject(SHOWN);
  });

  it('keeps each reader layer as its own native view', () => {
    for (const layer of readerLayers(hintShown()).layers)
      expect(layer.props.collapsable).toBe(false);
  });
});

describe('MetronomeScreen body that does not fit', () => {
  const BODY = 300;
  const OVERFLOWING = 400;
  const FITTING = 250;
  const ROOMY_WINDOW = metronome.compactBelowHeight;

  function layOutBody(body: number) {
    const onLayout = scroll.props?.onLayout as (event: unknown) => void;
    act(() => {
      onLayout({ nativeEvent: { layout: { y: 0, height: body } } });
    });
  }

  function sizeContent(content: number) {
    const onSize = scroll.props?.onContentSizeChange as (
      width: number,
      height: number,
    ) => void;
    act(() => {
      onSize(0, content);
    });
  }

  function measure(body: number, content: number) {
    layOutBody(body);
    sizeContent(content);
  }

  const screenSwipeEnabled = () => swipes.at(-2)?.enabled;

  function inScroll(screen: ReactTestRenderer, type: ElementType): number {
    return screen.root.findByType(ScrollView).findAllByType(type).length;
  }

  it('keeps the tempo block and the transport out of the scrolling controls', () => {
    const screen = mountScreen();
    expect(inScroll(screen, SwipeTempoZone)).toBe(0);
    expect(inScroll(screen, Transport)).toBe(0);
    expect(inScroll(screen, PresetRow)).toBe(1);
    expect(inScroll(screen, BeatDots)).toBe(1);
  });

  it('changes nothing while every control fits', () => {
    const screen = mountScreen();
    measure(BODY, FITTING);
    expect(zone.props?.tight).toBe(false);
    expect(zone.props?.swipeAnywhere).toBe(true);
    expect(screenSwipeEnabled()).toBe(true);
    expect(scroll.props?.showsVerticalScrollIndicator).toBe(false);
    expect(flatStyle(scroll.props?.contentContainerStyle).paddingBottom).toBe(
      pinnedStackScrollSlack(false, 1, COMPACT_GAP),
    );
    expect(screen.root.findAllByProps({ testID: 'scroll-fade' })).toHaveLength(
      0,
    );
  });

  it('judges nothing from a content size that lands before the body is laid out', () => {
    mountScreen();
    sizeContent(OVERFLOWING);
    expect(zone.props?.tight).toBe(false);
    expect(scroll.props?.scrollEnabled).toBe(false);
  });

  it('tightens the tempo block once the compact controls overflow, and keeps it', () => {
    mountScreen();
    measure(BODY, OVERFLOWING);
    expect(zone.props?.tight).toBe(true);
    sizeContent(FITTING);
    expect(zone.props?.tight).toBe(true);
  });

  it('leaves a roomy window that fits once compact with the full tempo block', () => {
    display.windowHeight = ROOMY_WINDOW;
    mountScreen();
    measure(BODY, OVERFLOWING);
    expect(zone.props?.tight).toBe(false);
    sizeContent(FITTING);
    expect(zone.props?.tight).toBe(false);
  });

  it('tightens a roomy window only when it still overflows once compact', () => {
    display.windowHeight = ROOMY_WINDOW;
    mountScreen();
    measure(BODY, OVERFLOWING);
    expect(zone.props?.tight).toBe(false);
    sizeContent(OVERFLOWING);
    expect(zone.props?.tight).toBe(true);
  });

  it('decides overflow without counting its own fade padding', () => {
    mountScreen();
    const justOver = BODY + 1;
    const justUnder = BODY - 1;
    measure(BODY, justOver);
    expect(scroll.props?.scrollEnabled).toBe(true);
    sizeContent(justUnder + metronome.scrollFade);
    expect(scroll.props?.scrollEnabled).toBe(false);
    sizeContent(justOver);
    expect(scroll.props?.scrollEnabled).toBe(true);
  });

  it('says swipe anywhere again once a tight block fits and the gesture is back', () => {
    mountScreen();
    measure(BODY, OVERFLOWING);
    expect(zone.props?.swipeAnywhere).toBe(false);
    sizeContent(FITTING);
    expect(zone.props?.tight).toBe(true);
    expect(screenSwipeEnabled()).toBe(true);
    expect(zone.props?.swipeAnywhere).toBe(true);
  });

  it('cues overflowing controls with a drawn scroll bar and a bottom fade', () => {
    const screen = mountScreen();
    measure(BODY, OVERFLOWING);
    expect(scroll.props?.scrollEnabled).toBe(true);
    expect(scroll.props?.showsVerticalScrollIndicator).toBe(true);
    expect(scroll.props?.persistentScrollbar).toBe(true);
    expect(screen.root.findAllByProps({ testID: 'scroll-fade' })).toHaveLength(
      1,
    );
    expect(flatStyle(scroll.props?.contentContainerStyle).paddingBottom).toBe(
      metronome.scrollFade,
    );
  });

  it('scrolls the poly row into view under a pinned stack at 2.0 while playing', () => {
    display.fontScale = 2;
    display.running = true;
    const screen = mountScreen();
    measure(BODY, OVERFLOWING);
    expect(inScroll(screen, BeatDots)).toBe(1);
    expect(scroll.props?.scrollEnabled).toBe(true);
    expect(flatStyle(scroll.props?.contentContainerStyle).paddingBottom).toBe(
      pinnedStackScrollSlack(true, 2, COMPACT_GAP) + metronome.scrollFade,
    );
  });
});
