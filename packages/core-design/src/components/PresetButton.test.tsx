import { type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { StyleProp, ViewStyle } from 'react-native';
import { describe, expect, it, vi } from 'vitest';

import { inset, textRoles } from '../roles.ts';
import { ThemeProvider } from '../ThemeProvider.tsx';
import { PresetButton, type PresetButtonKind } from './PresetButton.tsx';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const display = vi.hoisted(() => ({ fontScale: 1 }));
const faces = vi.hoisted(() => [] as Props[]);
const fits = vi.hoisted(() => [] as Record<string, unknown>[]);

vi.mock('react-native', async (original) => {
  const actual = await original<Record<string, unknown>>();
  const { createElement: h } = await import('react');
  return {
    ...actual,
    useWindowDimensions: () => ({ fontScale: display.fontScale }),
    Pressable: (props: Props) => h('div', null, props.children),
    View: (props: Props) => {
      faces.push(props);
      return h('div', null, props.children);
    },
  };
});

vi.mock('../useOneLineFit.tsx', async (original) => {
  const actual = await original<typeof import('../useOneLineFit.tsx')>();
  return {
    ...actual,
    useOneLineFit: (options: Parameters<typeof actual.useOneLineFit>[0]) => {
      fits.push({ ...options });
      return actual.useOneLineFit(options);
    },
  };
});

const { StyleSheet } = await import('react-native');

const LABEL = '−10';
const GROWN_FONT_SCALE = 2;
const KINDS: readonly PresetButtonKind[] = ['preset', 'action'];
const ROLE = { preset: textRoles.preset, action: textRoles.presetAction };

function renderAt(fontScale: number, kind: PresetButtonKind = 'preset') {
  display.fontScale = fontScale;
  faces.length = 0;
  fits.length = 0;
  renderToStaticMarkup(
    <ThemeProvider mode="dark">
      <PresetButton kind={kind} label={LABEL} onPress={vi.fn()} />
    </ThemeProvider>,
  );
}

function faceAt(
  fontScale: number,
  kind: PresetButtonKind = 'preset',
): ViewStyle {
  renderAt(fontScale, kind);
  return StyleSheet.flatten(faces[0]?.style as StyleProp<ViewStyle>);
}

describe('PresetButton under font scale', () => {
  it('keeps the design spacing at the default scale', () => {
    expect(faceAt(1).paddingHorizontal).toBeUndefined();
    expect(faceAt(1, 'action').paddingHorizontal).toBeUndefined();
  });

  it('keeps a grown label clear of the key edge', () => {
    expect(faceAt(GROWN_FONT_SCALE).paddingHorizontal).toBe(inset.presetLabelH);
    expect(faceAt(GROWN_FONT_SCALE, 'action').paddingHorizontal).toBe(
      inset.presetLabelH,
    );
  });

  it.each(KINDS)('fits the %s label in its own role', (kind) => {
    renderAt(GROWN_FONT_SCALE, kind);
    expect(fits[0]).toMatchObject({ text: LABEL, role: ROLE[kind] });
  });

  it('measures the room inside the padding, not the face', () => {
    renderAt(GROWN_FONT_SCALE);
    const box = faces.filter((face) => face.onLayout !== undefined);
    expect(faces[0]?.onLayout).toBeUndefined();
    expect(box).toHaveLength(1);
    const style = StyleSheet.flatten(box[0]?.style as StyleProp<ViewStyle>);
    expect(style.alignSelf).toBe('stretch');
    expect(style.paddingHorizontal).toBeUndefined();
  });
});
