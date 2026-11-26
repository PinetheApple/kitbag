// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act } from 'react';
import { create } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { fontFace } from '../fontFaces.ts';
import { textRoles } from '../roles.ts';
import { DrawnLiveSlot } from './DrawnLiveSlot.tsx';
import { drawn, drawnAs, liveProps } from './svgRecorder.test-helper.ts';

vi.mock('react-native', () => ({
  View: 'View',
  Text: 'Text',
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
  };
});

const ROLE_NAME = 'statusMeta';
const ROLE = textRoles[ROLE_NAME];
const INK = '#123456';
const WIDEST = '8 of 8';

function draw(text: { value: string }) {
  let renderer: ReturnType<typeof create> | undefined;
  act(() => {
    renderer = create(
      <DrawnLiveSlot
        text={text as never}
        role={ROLE_NAME}
        widest={WIDEST}
        color={INK}
      />,
    );
  });
  if (renderer === undefined) throw new Error('nothing mounted');
  return renderer;
}

beforeEach(() => {
  drawn.length = 0;
});

describe('DrawnLiveSlot', () => {
  it('draws the live text as svg in the role face, following the value with no render', () => {
    const text = { value: '1 of 8' };
    draw(text);
    expect(drawnAs('SvgText')[0]).toMatchObject({
      fill: INK,
      fontFamily: fontFace(ROLE.family, ROLE.weight),
      fontSize: ROLE.size,
      alignmentBaseline: 'top',
    });
    const span = drawnAs('TSpan')[0];
    expect(span?.children).toBe('1 of 8');
    expect(liveProps(span)).toEqual({ content: '1 of 8' });
    text.value = '2 of 8';
    expect(liveProps(span)).toEqual({ content: '2 of 8' });
    expect(drawnAs('TSpan')).toHaveLength(1);
  });

  it('holds its size with the widest text in a Text hidden from readers', () => {
    const ghost = draw({ value: '1 of 8' }).root.findByType('Text' as never);
    expect(ghost.props).toMatchObject({
      children: WIDEST,
      importantForAccessibility: 'no',
    });
  });
});
