// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act, createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { View } from 'react-native';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

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
}));
const hint = vi.hoisted(() => ({ props: null as Props | null }));
const scroll = vi.hoisted(() => ({ props: null as Props | null }));

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
      height: 800,
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
vi.mock('./useTempoSwipe.ts', () => ({ useTempoSwipe: () => ({}) }));
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
vi.mock('./SwipeTempoZone.tsx', () => ({ SwipeTempoZone: () => null }));
vi.mock('./Transport.tsx', () => ({ Transport: () => null }));
vi.mock('./UnsavedSnackbar.tsx', () => ({ UnsavedSnackbar: () => null }));

const { MetronomeScreen } = await import('./MetronomeScreen.tsx');

function renderBody(fontScale: number, running: boolean): string {
  display.fontScale = fontScale;
  display.running = running;
  return renderToStaticMarkup(
    createElement(MetronomeScreen, { insets: { top: 0, bottom: 0 } }),
  );
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

describe('MetronomeScreen scroll body', () => {
  it('pads the content by the pinned stack slack, running and stopped', () => {
    for (const running of [false, true]) {
      const slack = pinnedStackScrollSlack(running, 2);
      expect(slack).toBeGreaterThan(0);
      expect(scrollPadding(2, running)).toBe(slack);
    }
  });

  it('adds no padding at the default text size', () => {
    expect(scrollPadding(1, false)).toBe(0);
    expect(scrollPadding(1, true)).toBe(0);
  });

  it('extends the viewport under the running stack only', () => {
    const overlap = pinnedViewportOverlap(true, 2);
    expect(overlap).toBeGreaterThan(0);
    expect(viewportBottom(2, true)).toBe(-overlap);
    expect(viewportBottom(2, false)).toBe(-0);
    expect(viewportBottom(1, true)).toBe(-0);
  });

  it('clips the extended viewport to the space above the stack', () => {
    expect(renderBody(2, true)).toContain(
      '<div data-overflow="hidden"><div data-scroll="true">',
    );
  });

  it('places the swipe hint from the clip, the scroll view sitting at its top', () => {
    const CLIP_TOP = 50;
    const ZONE_TOP = 20;
    const ZONE_HEIGHT = 100;
    display.hintSeen = false;
    (globalThis as Record<string, unknown>).IS_REACT_ACT_ENVIRONMENT = true;
    const mounted: { screen?: ReactTestRenderer } = {};
    act(() => {
      mounted.screen = create(
        createElement(MetronomeScreen, { insets: { top: 0, bottom: 0 } }),
      );
    });
    const laidOut = (mounted.screen?.root.findAllByType(View) ?? []).filter(
      (view) => view.props.onLayout !== undefined,
    );
    const isClip = (view: { readonly props: Props }) =>
      flatStyle(view.props.style).overflow === 'hidden';
    const clip = laidOut.find(isClip);
    const zone = laidOut.find((view) => !isClip(view));
    if (clip === undefined || zone === undefined) {
      throw new Error('clip or tempo zone has no onLayout');
    }
    layOut(clip, CLIP_TOP, ZONE_HEIGHT);
    layOut(zone, ZONE_TOP, ZONE_HEIGHT);
    expect(hint.props?.zoneTop).toBe(CLIP_TOP + ZONE_TOP);
    display.hintSeen = true;
  });
});
