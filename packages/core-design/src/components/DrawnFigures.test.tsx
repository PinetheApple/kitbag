// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act } from 'react';
import { create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fontFace } from '../fontFaces.ts';
import { textRoles } from '../roles.ts';
import { buildTheme } from '../theme.ts';
import { ThemeProvider } from '../ThemeProvider.tsx';
import { DrawnFigures, type DrawnFiguresProps } from './DrawnFigures.tsx';
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

const ROLE_NAME = 'chipValue';
const ROLE = textRoles[ROLE_NAME];
const INK = buildTheme('dark').color.text2;
const DOUBLE_SCALE = 2;

function draw(text: string): Record<string, unknown> {
  let renderer: ReturnType<typeof create> | undefined;
  act(() => {
    renderer = create(
      <ThemeProvider mode="dark">
        <DrawnFigures text={text} role={ROLE_NAME} color="text2" />
      </ThemeProvider>,
    );
  });
  return renderer?.root.findByType('Text' as never).props as Record<
    string,
    unknown
  >;
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
    const before = draw('0:10');
    const after = draw('0:11');
    expect(before.children).toBe('0:00');
    expect(before.numberOfLines).toBe(1);
    expect(after.children).toBe(before.children);
    expect(draw('10:00').children).toBe('00:00');
  });

  it('scales the drawn size with the system font scale, as Text does', () => {
    display.fontScale = DOUBLE_SCALE;
    draw('0:10');
    expect(drawnAs('SvgText')[0]?.fontSize).toBe(ROLE.size * DOUBLE_SCALE);
  });

  it('refuses roles whose tracking or case the drawing would not follow', () => {
    // @ts-expect-error tempoCaption carries tracking
    const tracked: DrawnFiguresProps['role'] = 'tempoCaption';
    expect(tracked).toBe('tempoCaption');
  });
});
