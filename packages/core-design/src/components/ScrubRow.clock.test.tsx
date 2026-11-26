// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act } from 'react';
import {
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '../ThemeProvider.tsx';
import { drawn, drawnAs, liveProps } from './svgRecorder.test-helper.ts';

const sliders = vi.hoisted(() => [] as Record<string, unknown>[]);

vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  TextInput: 'TextInput',
  StyleSheet: { create: <T,>(styles: T) => styles, absoluteFill: {} },
  useWindowDimensions: () => ({ fontScale: 1 }),
}));
vi.mock(
  'react-native-svg',
  async () => (await import('./svgRecorder.test-helper.ts')).svg,
);
vi.mock('react-native-reanimated', async () => {
  const { live } = await import('./svgRecorder.test-helper.ts');
  return {
    default: { createAnimatedComponent: <T,>(component: T) => component },
    useAnimatedProps: live,
    useAnimatedReaction: () => undefined,
    useDerivedValue: live,
    useSharedValue: (value: unknown) => ({ value }),
  };
});
vi.mock('react-native-worklets', () => ({ scheduleOnRN: () => undefined }));
vi.mock('../useAccessibilityReadout.ts', () => ({
  useAccessibilityReadout: () => false,
}));
vi.mock('./Slider.tsx', () => ({
  Slider: (props: Record<string, unknown>) => {
    sliders.push(props);
    return null;
  },
}));
vi.mock('./Icon.tsx', () => ({ Icon: () => null }));
vi.mock('./LoopMarks.tsx', () => ({
  LoopMarks: () => null,
  LoopHandleLayer: () => null,
  useLoopGeometry: () => ({ lane: { value: null }, bar: { value: null } }),
}));

const { ScrubRow } = await import('./ScrubRow.tsx');

const TOTAL = '3:45';
const noop = vi.fn();
const frame = {
  progress: { value: 0 },
  elapsed: { value: '0:10' },
  second: { value: 10 },
  hold: vi.fn(),
};

function shownText(node: ReactTestInstance): string {
  const animated = node.props.animatedProps as { value: object } | undefined;
  if (animated !== undefined) return String(liveProps(node.props).text);
  return node.children
    .map((child) => (typeof child === 'string' ? child : ''))
    .join('');
}

function textNodes(root: ReactTestInstance): string[] {
  return root
    .findAll(
      (node) =>
        (node.type as unknown) === 'Text' ||
        (node.type as unknown) === 'TextInput',
    )
    .map(shownText);
}

function row() {
  return (
    <ThemeProvider mode="dark">
      <ScrubRow
        frame={frame as never}
        durationFrames={0}
        total={TOTAL}
        spokenPosition={String}
        marks={null}
        note={null}
        onScrub={noop}
        onCancel={noop}
        onSeek={noop}
      />
    </ThemeProvider>
  );
}

function mountTree(): ReactTestRenderer {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(row());
  });
  if (tree === undefined) throw new Error('nothing mounted');
  return tree;
}

function mount(): ReactTestInstance {
  return mountTree().root;
}

beforeEach(() => {
  drawn.length = 0;
  sliders.length = 0;
  frame.elapsed.value = '0:10';
  frame.second.value = 10;
});

describe('ScrubRow clock', () => {
  it('leaves every Text still while the position moves', () => {
    const root = mount();
    const before = textNodes(root);
    frame.elapsed.value = '0:11';
    expect(textNodes(root)).toEqual(before);
    expect(before).not.toContain('0:10');
  });

  it('draws the elapsed time, following the position on the UI thread', () => {
    mount();
    const content = () => liveProps(drawnAs('TSpan').at(-1)).content;
    expect(content()).toBe('0:10');
    frame.elapsed.value = '0:11';
    expect(content()).toBe('0:11');
  });

  it('keeps the spoken position still through a re-render while no reader is on', () => {
    const tree = mountTree();
    const before = sliders.at(-1);
    frame.elapsed.value = '0:11';
    frame.second.value = 11;
    act(() => {
      tree.update(row());
    });
    const after = sliders.at(-1);
    expect(sliders.length).toBeGreaterThan(1);
    expect(after?.accessibilityLabel).toBe('Song position');
    expect(after?.accessibilityValue).toBe(before?.accessibilityValue);
  });

  it('paints the elapsed time first, not the sizing figures', () => {
    mount();
    expect(drawnAs('TSpan').at(-1)?.children).toBe('0:10');
  });

  it('sizes the clock for one more minute digit than the total', () => {
    const [ghost] = mount().findAll(
      (node) => (node.type as unknown) === 'Text',
    );
    expect(ghost?.props.children).toBe('00:00');
  });
});
