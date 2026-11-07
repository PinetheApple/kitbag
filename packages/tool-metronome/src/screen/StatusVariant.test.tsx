import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { statusRowPitch } from '../logic/belowTempo.ts';
import type { StatusRow, StatusRows } from '../logic/statusRows.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };
type Style = Readonly<Record<string, unknown>>;

const display = vi.hoisted(() => ({ fontScale: 1 }));
const drawn = vi.hoisted(() => ({ props: null as Props | null }));

vi.mock('react-native', () => ({
  useWindowDimensions: () => ({ fontScale: display.fontScale }),
}));

vi.mock('react-native-reanimated', () => ({
  default: {
    View: (props: Props) => {
      drawn.props = props;
      return null;
    },
  },
  useAnimatedStyle: (build: () => unknown) => build(),
}));

vi.mock('./statusStyles.ts', () => ({
  useStatusStyles: () => ({
    variant: { position: 'absolute', top: 0 },
    pinnedVariant: { top: 'auto', bottom: 0 },
    wrapped: {},
  }),
}));

const { StatusVariant } = await import('./StatusVariant.tsx');

function draw(fontScale: number, rows: StatusRows, shown: StatusRow): Style {
  display.fontScale = fontScale;
  renderToStaticMarkup(
    <StatusVariant rows={{ value: rows } as never} shown={shown} style={{}}>
      {null}
    </StatusVariant>,
  );
  const layers = [drawn.props?.style].flat(Infinity) as Style[];
  return Object.assign({}, ...layers) as Style;
}

function offset(style: Style): unknown {
  const [move] = style.transform as readonly { translateY: unknown }[];
  return move?.translateY;
}

const LONE: StatusRows = { first: 'ramp', second: 'none' };
const PAIR: StatusRows = { first: 'mute', second: 'ramp' };

describe('StatusVariant', () => {
  it('hangs rows from the stack top at the default text size', () => {
    expect(draw(1, LONE, 'ramp').top).toBe(0);
    expect(draw(1, LONE, 'ramp').bottom).toBeUndefined();
    expect(offset(draw(1, LONE, 'ramp'))).toBe(statusRowPitch(1));
    expect(offset(draw(1, PAIR, 'mute'))).toBe(0);
  });

  it('seats a lone pinned row on the stack foot, so it fits a one-row stack', () => {
    const style = draw(2, LONE, 'ramp');
    expect(style.bottom).toBe(0);
    expect(style.top).toBe('auto');
    expect(offset(style)).toBeCloseTo(0);
  });

  it('keeps a pinned pair one pitch apart above the stack foot', () => {
    expect(offset(draw(2, PAIR, 'ramp'))).toBeCloseTo(0);
    expect(offset(draw(2, PAIR, 'mute'))).toBe(-statusRowPitch(2));
  });
});
