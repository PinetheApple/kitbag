// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act } from 'react';
import { create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fontFace } from '../fontFaces.ts';
import { textRoles } from '../roles.ts';
import { DrawnFigures } from './DrawnFigures.tsx';
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

const ROLE = textRoles.chipValue;
const INK = '#123456';
const DOUBLE_SCALE = 2;

function draw(text: string) {
  let renderer: ReturnType<typeof create> | undefined;
  act(() => {
    renderer = create(<DrawnFigures text={text} role={ROLE} color={INK} />);
  });
  const ghost = renderer?.root.findByType('Text' as never);
  return { ghost: ghost?.props as Record<string, unknown> };
}

beforeEach(() => {
  drawn.length = 0;
  display.fontScale = 1;
});

describe('DrawnFigures', () => {
  it('draws the figures as svg text in the role face, from the top of the font box', () => {
    draw('12:34');
    const [svgText] = drawnAs('SvgText');
    expect(svgText).toMatchObject({
      children: '12:34',
      fill: INK,
      fontFamily: fontFace(ROLE.family, ROLE.weight),
      fontSize: ROLE.size,
      fontFeatureSettings: "'tnum'",
      alignmentBaseline: 'top',
    });
  });

  it('sizes itself from a Text that changes only when the figure count does', () => {
    const before = draw('0:10').ghost;
    const after = draw('0:11').ghost;
    expect(before.children).toBe('0:00');
    expect(after.children).toBe(before.children);
    expect(draw('10:00').ghost.children).toBe('00:00');
  });

  it('scales the drawn size with the system font scale, as Text does', () => {
    display.fontScale = DOUBLE_SCALE;
    draw('0:10');
    expect(drawnAs('SvgText')[0]?.fontSize).toBe(ROLE.size * DOUBLE_SCALE);
  });
});
