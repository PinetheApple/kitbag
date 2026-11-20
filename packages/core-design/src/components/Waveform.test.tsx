// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act, type ReactNode } from 'react';
import {
  create,
  type ReactTestRenderer,
  type ReactTestRendererJSON,
} from 'react-test-renderer';
import { expect, it, vi } from 'vitest';

import { Waveform } from './Waveform.tsx';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const MEASURED_WIDTH = 300;

const animated = vi.hoisted(() => [] as object[]);

vi.mock('react-native', () => ({
  View: 'View',
  StyleSheet: { create: <T,>(styles: T) => styles },
}));
vi.mock('react-native-svg', () => ({ default: 'Svg', Path: 'Path' }));
vi.mock('../ThemeProvider.tsx', () => ({
  useTheme: () => ({ color: { wave: 'wave', waveHot: 'waveHot' } }),
}));
vi.mock('react-native-reanimated', async () => {
  const { createElement: h } = await import('react');
  return {
    default: {
      View: (props: Props) => {
        const [, shift] = props.style as [object, object];
        animated.push(shift);
        return h('AnimatedView', null, props.children);
      },
    },
    useAnimatedStyle: (updater: () => object) => updater(),
  };
});

function mount(bars: number, progress: number) {
  animated.length = 0;
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(
      <Waveform
        envelope={[1, 0.5]}
        bars={bars}
        height={10}
        progress={{ value: progress } as never}
      />,
    );
  });
  if (tree === undefined) throw new Error('Waveform did not mount');
  return tree;
}

function shifts(progress: number) {
  mount(2, progress);
  return animated.map(
    (style) => (style as { transform: object[] }).transform[0],
  );
}

function hostCount(node: ReactTestRendererJSON | string): number {
  if (typeof node === 'string') return 0;
  return 1 + (node.children ?? []).reduce((sum, c) => sum + hostCount(c), 0);
}

function paths(tree: ReactTestRenderer): unknown[] {
  return tree.root
    .findAll((node) => node.type === ('Path' as never))
    .map((node) => node.props.d as unknown);
}

it('draws nothing played on a paused remount before the lane is measured', () => {
  expect(shifts(0)).toEqual([{ translateX: '-100%' }, { translateX: '100%' }]);
});

it('draws the played share of the lane from the first frame', () => {
  expect(shifts(0.25)).toEqual([{ translateX: '-75%' }, { translateX: '75%' }]);
  expect(shifts(1)).toEqual([{ translateX: '0%' }, { translateX: '0%' }]);
});

it('draws each layer as one shape however many bars it has', () => {
  const many = mount(64, 0.5).toJSON() as ReactTestRendererJSON;
  const few = mount(2, 0.5).toJSON() as ReactTestRendererJSON;
  expect(hostCount(many)).toBe(hostCount(few));
});

it('draws the bars on both layers once the lane is measured', () => {
  const tree = mount(2, 0.5);
  const lane = tree.root.find((node) => node.props.onLayout !== undefined);
  act(() => {
    (lane.props.onLayout as (event: object) => void)({
      nativeEvent: { layout: { width: MEASURED_WIDTH } },
    });
  });
  const drawn = paths(tree);
  expect(drawn).toHaveLength(2);
  for (const d of drawn) expect(d).toMatch(/^M.+Z$/);
});
