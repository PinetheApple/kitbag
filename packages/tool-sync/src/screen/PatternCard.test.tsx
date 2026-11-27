import { KB_ACCENT } from '@kitbag/core-native';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

vi.mock('react-native', async () => {
  const { createElement: h } = await import('react');
  const host = (props: Props) => h('div', null, props.children);
  return { View: host, StyleSheet: { create: <T,>(s: T) => s } };
});

const drawn = vi.hoisted(() => ({
  chips: [] as Props[],
  dots: [] as Props[],
  running: [] as boolean[],
}));
const store = vi.hoisted(() => ({
  pattern: {
    beatsPerBar: 4,
    denominator: 4,
    subdivision: 2,
    accents: [] as number[],
  },
  setAccents: vi.fn(),
}));

vi.mock('@kitbag/core-design', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  createThemedStyles: () => () => ({}),
  PickerChips: (props: Props) => {
    drawn.chips.push(props);
    return null;
  },
  BeatDotGrid: (props: Props) => {
    drawn.dots.push(props);
    return null;
  },
}));

vi.mock('@kitbag/core-state', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  getPlayAlongStore: () => ({ getState: () => store }),
}));

vi.mock('./playAlongHooks.ts', () => ({
  usePlayAlong: <T,>(selector: (state: typeof store) => T) => selector(store),
}));

vi.mock('./useClickFrame.ts', () => ({
  useClickFrame: (running: boolean) => {
    drawn.running.push(running);
    return {};
  },
}));

const { PatternCard } = await import('./PatternCard.tsx');

function draw(props: { readonly following: boolean; readonly muted: boolean }) {
  drawn.chips.length = 0;
  drawn.dots.length = 0;
  drawn.running.length = 0;
  renderToStaticMarkup(
    createElement(PatternCard, {
      ...props,
      onOpenMeter: vi.fn(),
      onOpenSubdivision: vi.fn(),
    }),
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  store.pattern.accents = [
    KB_ACCENT.KB_ACCENT_ACCENTED,
    KB_ACCENT.KB_ACCENT_NORMAL,
    KB_ACCENT.KB_ACCENT_NORMAL,
    KB_ACCENT.KB_ACCENT_NORMAL,
  ];
});

describe('PatternCard', () => {
  it("shows the play-along pattern on the metronome's own chips", () => {
    draw({ following: false, muted: false });
    expect(drawn.chips[0]).toMatchObject({
      beatsPerBar: 4,
      denominator: 4,
      subdivision: 2,
    });
  });

  it('draws one beat dot per beat in its accent state', () => {
    draw({ following: false, muted: false });
    expect(drawn.dots[0]?.states).toEqual([
      'accented',
      'normal',
      'normal',
      'normal',
    ]);
  });

  it('cycles a tapped beat in the play-along pattern', () => {
    draw({ following: false, muted: false });
    const onCycle = drawn.dots[0]?.onCycle as (beat: number) => void;
    onCycle(1);
    expect(store.setAccents).toHaveBeenCalledWith([
      KB_ACCENT.KB_ACCENT_ACCENTED,
      KB_ACCENT.KB_ACCENT_MUTED,
      KB_ACCENT.KB_ACCENT_NORMAL,
      KB_ACCENT.KB_ACCENT_NORMAL,
    ]);
  });

  it('reads the click only while it follows a song', () => {
    draw({ following: true, muted: false });
    expect(drawn.running).toEqual([true]);
    draw({ following: false, muted: false });
    expect(drawn.running).toEqual([false]);
  });
});
