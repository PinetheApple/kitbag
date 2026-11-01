import {
  bodyLineHeight,
  calibration,
  calibrationText,
} from '@kitbag/core-design';
import { isValidElement, type ReactElement, type ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

vi.mock('react', async (original) => ({
  ...(await original<typeof import('react')>()),
  useMemo: <T>(make: () => T) => make(),
}));

vi.mock('react-native', () => ({ Text: 'Text', View: 'View' }));

vi.mock('@kitbag/core-design', async (original) => {
  const pure = await original<Record<string, unknown>>();
  const theme = { color: new Proxy({}, { get: () => '#000000' }) };
  return {
    ...pure,
    createThemedStyles:
      <T>(factory: (t: typeof theme) => T) =>
      () =>
        factory(theme),
    textStyle: () => ({}),
  };
});

const { CalibrationScatter } = await import('./CalibrationScatter.tsx');

type Style = Record<string, unknown>;
type Node = ReactElement<{ style?: unknown; children?: ReactNode }>;

function flat(style: unknown): Style {
  if (Array.isArray(style))
    return Object.assign({}, ...style.map(flat)) as Style;
  return typeof style === 'object' && style !== null ? (style as Style) : {};
}

function bottomsOf(
  node: Node,
  inherited: number,
  pick: (style: Style) => boolean,
): number[] {
  const style = flat(node.props.style);
  const bottom =
    inherited + (typeof style.bottom === 'number' ? style.bottom : 0);
  const children = [node.props.children]
    .flat(Infinity)
    .filter((child): child is Node => isValidElement(child));
  const own = pick(style) ? [bottom] : [];
  return own.concat(...children.map((child) => bottomsOf(child, bottom, pick)));
}

const LABEL_ROW =
  calibration.axisBottom + calibrationText.scatterAxis.size * bodyLineHeight;

describe('calibration scatter', () => {
  it('stops the mean and zero lines at the top of the axis label row', () => {
    const root = CalibrationScatter({
      dots: [],
      meanX: 0.5,
      axisMs: 200,
    }) as Node;
    const lineBottoms = bottomsOf(
      root,
      0,
      (style) =>
        style.top === 0 &&
        style.bottom === 0 &&
        typeof style.width === 'number' &&
        style.width <= calibration.meanLine,
    );
    expect(lineBottoms).toHaveLength(2);
    lineBottoms.forEach((bottom) => {
      expect(bottom).toBeGreaterThanOrEqual(LABEL_ROW);
    });
  });
});
