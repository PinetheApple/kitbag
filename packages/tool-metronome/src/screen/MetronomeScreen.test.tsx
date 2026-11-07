import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { pinnedStackScrollSlack } from '../logic/belowTempo.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const display = vi.hoisted(() => ({ fontScale: 1, running: false }));
const scroll = vi.hoisted(() => ({ props: null as Props | null }));

vi.mock('react-native', async () => {
  const { createElement: h } = await import('react');
  const box = (props: Props) => h('div', null, props.children);
  return {
    View: box,
    Text: box,
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
      return h('div', null, props.children);
    },
  };
});

vi.mock('@kitbag/core-design', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  createThemedStyles: () => () => new Proxy({}, { get: () => ({}) }),
}));

vi.mock('@kitbag/core-state', () => ({
  BPM_BOUNDS: { min: 20, max: 300 },
  getPracticeSessionStore: () => ({ getState: () => ({ pending: [] }) }),
  useLibrary: (select: (state: unknown) => unknown) =>
    select({ loaded: null, presets: [] }),
  useMetronome: (select: (state: unknown) => unknown) =>
    select({ running: display.running, beatsPerBar: 4, polyEnabled: false }),
  useSwipeHint: (select: (state: unknown) => unknown) =>
    select({ seen: true, dismiss: () => undefined }),
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
vi.mock('./SwipeHint.tsx', () => ({ SwipeHint: () => null }));
vi.mock('./SwipeTempoZone.tsx', () => ({ SwipeTempoZone: () => null }));
vi.mock('./Transport.tsx', () => ({ Transport: () => null }));
vi.mock('./UnsavedSnackbar.tsx', () => ({ UnsavedSnackbar: () => null }));

const { MetronomeScreen } = await import('./MetronomeScreen.tsx');

function scrollPadding(fontScale: number, running: boolean): unknown {
  display.fontScale = fontScale;
  display.running = running;
  renderToStaticMarkup(
    createElement(MetronomeScreen, { insets: { top: 0, bottom: 0 } }),
  );
  const styles = [scroll.props?.contentContainerStyle].flat() as {
    readonly paddingBottom?: number;
  }[];
  return styles.find((style) => style.paddingBottom !== undefined)
    ?.paddingBottom;
}

describe('MetronomeScreen scroll body', () => {
  it('pads the content by the pinned stack slack when stopped', () => {
    const slack = pinnedStackScrollSlack(false, 2);
    expect(slack).toBeGreaterThan(0);
    expect(scrollPadding(2, false)).toBe(slack);
  });

  it('adds no padding while running or at the default text size', () => {
    expect(scrollPadding(2, true)).toBe(0);
    expect(scrollPadding(1, false)).toBe(0);
  });
});
