// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { iconSizes, metronome, minTouchTargetDp } from '@kitbag/core-design';
import { BPM_BOUNDS } from '@kitbag/core-state';
import { act, createElement } from 'react';
import {
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

type Style = Readonly<Record<string, unknown>>;

const BPM = 132;

vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  Pressable: 'Pressable',
  TextInput: 'TextInput',
  StyleSheet: { absoluteFill: { position: 'absolute' } },
}));
vi.mock('react-native-reanimated', () => ({
  default: { createAnimatedComponent: (component: unknown) => component },
  useAnimatedProps: () => ({}),
}));
vi.mock('@kitbag/core-design', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  createThemedStyles: (build: (theme: unknown) => unknown) => () =>
    build({ color: {} }),
  textStyle: () => ({}),
  Icon: 'Icon',
}));
vi.mock('@kitbag/core-state', () => ({ BPM_BOUNDS: { min: 20, max: 300 } }));
vi.mock('./BarSweep.tsx', () => ({ BarSweep: 'BarSweep' }));

const { SwipeTempoZone } = await import('./SwipeTempoZone.tsx');

const flat = (style: unknown): Style =>
  Object.assign({}, ...[style].flat(Infinity).filter(Boolean)) as Style;

const isHost = (name: string) => (node: ReactTestInstance) =>
  (node.type as unknown) === name;

function renderTight(swipeAnywhere: boolean): ReactTestInstance {
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = create(
      createElement(SwipeTempoZone, {
        bpm: BPM,
        density: 'compact',
        tight: true,
        swipeAnywhere,
        currentBpm: { value: BPM } as never,
        barPhase: { value: 0 } as never,
        onTypeTempo: vi.fn(),
        onNudge: vi.fn(),
      }),
    );
  });
  if (renderer === undefined) throw new Error('nothing rendered');
  return renderer.root;
}

describe('the tight tempo block', () => {
  it('puts the arrows either side of the reading, down first', () => {
    const labels = renderTight(false)
      .findAll(isHost('Pressable'))
      .map((node) => node.props.accessibilityLabel as string);
    expect(labels).toEqual(['Decrease tempo', 'Tempo', 'Increase tempo']);
  });

  it('gives each arrow a fixed 48dp width and a 48dp reach', () => {
    const arrows = renderTight(false)
      .findAll(isHost('Pressable'))
      .filter((node) => node.props.accessibilityLabel !== 'Tempo');
    for (const arrow of arrows) {
      const reach = arrow.props.hitSlop as { top: number; bottom: number };
      expect(flat(arrow.props.style).width).toBe(minTouchTargetDp);
      expect(reach.top + iconSizes.chevron + reach.bottom).toBe(
        minTouchTargetDp,
      );
    }
  });

  it('sizes the reading by the widest tempo so a third digit cannot shove the arrows', () => {
    const reading = renderTight(false).find(
      (node) =>
        isHost('Pressable')(node) && node.props.accessibilityLabel === 'Tempo',
    );
    const ghost = reading.find(isHost('Text'));
    const input = reading.find(isHost('TextInput'));
    expect(ghost.props.children).toBe(String(BPM_BOUNDS.max));
    expect(ghost.props.maxFontSizeMultiplier).toBe(
      input.props.maxFontSizeMultiplier,
    );
    expect(flat(input.props.style).position).toBe('absolute');
  });

  it('caps the numeral at the compact numeral size', () => {
    const input = renderTight(false).find(isHost('TextInput'));
    expect(
      Number(input.props.maxFontSizeMultiplier) * metronome.tempoNumeralTight,
    ).toBe(metronome.tempoNumeralCompact);
  });

  it('drops swipe anywhere from the caption only while the swipe is off', () => {
    const caption = (swipeAnywhere: boolean) =>
      renderTight(swipeAnywhere)
        .findAll(isHost('Text'))
        .map((node) => node.props.children as unknown)
        .find((text) => typeof text === 'string' && text.startsWith('BPM'));
    expect(caption(false)).not.toContain('SWIPE ANYWHERE');
    expect(caption(true)).toContain('SWIPE ANYWHERE');
  });
});
