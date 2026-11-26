// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act } from 'react';
import { create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fontFace } from '../fontFaces.ts';
import { textRoles } from '../roles.ts';
import { DrawnLineLabel } from './DrawnLineLabel.tsx';
import { drawn, drawnAs } from './svgRecorder.test-helper.ts';

const display = vi.hoisted(() => ({ fontScale: 1 }));

vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
  StyleSheet: { create: <T,>(styles: T) => styles, absoluteFill: {} },
  useWindowDimensions: () => ({ fontScale: display.fontScale }),
}));
vi.mock(
  'react-native-svg',
  async () => (await import('./svgRecorder.test-helper.ts')).svg,
);

const ROLE = textRoles.beatMarker;
const LINE = 14;
const WIDTH = 40;
const INK = '#123456';
const DOUBLE_SCALE = 2;
const SMALL_SCALE = 0.85;

function draw(text: string) {
  let renderer: ReturnType<typeof create> | undefined;
  act(() => {
    renderer = create(
      <DrawnLineLabel
        text={text}
        role="beatMarker"
        lineHeight={LINE}
        width={WIDTH}
        color={INK}
      />,
    );
  });
  if (renderer === undefined) throw new Error('nothing mounted');
  return renderer.root.findByType('View' as never).props as Record<
    string,
    unknown
  >;
}

beforeEach(() => {
  drawn.length = 0;
  display.fontScale = 1;
});

describe('DrawnLineLabel', () => {
  it('draws the label as svg centred in its line, in the role face, with no native Text', () => {
    const box = draw('1');
    expect(box.style).toEqual({ width: WIDTH, height: LINE });
    expect(drawnAs('SvgText')[0]).toMatchObject({
      children: '1',
      fill: INK,
      fontFamily: fontFace(ROLE.family, ROLE.weight),
      fontSize: ROLE.size,
      transform: `translate(${String(WIDTH / 2)} ${String(LINE / 2)})`,
      textAnchor: 'middle',
      alignmentBaseline: 'central',
    });
    expect(drawnAs('SvgText')[0]).not.toHaveProperty('fontFeatureSettings');
  });

  it('grows its line and glyph with the system font scale, as a Text would', () => {
    display.fontScale = DOUBLE_SCALE;
    expect(draw('1').style).toEqual({
      width: WIDTH,
      height: LINE * DOUBLE_SCALE,
    });
    expect(drawnAs('SvgText')[0]?.fontSize).toBe(ROLE.size * DOUBLE_SCALE);
  });

  it('keeps its line at the design height below the default scale', () => {
    display.fontScale = SMALL_SCALE;
    expect(draw('1').style).toEqual({ width: WIDTH, height: LINE });
    expect(drawnAs('SvgText')[0]?.transform).toBe(
      `translate(${String(WIDTH / 2)} ${String((LINE * SMALL_SCALE) / 2)})`,
    );
  });

  it('holds the line with nothing drawn for a blank label', () => {
    expect(draw('\u00A0').style).toEqual({ width: WIDTH, height: LINE });
    expect(drawnAs('SvgText')).toEqual([]);
  });
});
