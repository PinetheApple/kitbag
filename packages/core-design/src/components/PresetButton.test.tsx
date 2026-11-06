import { type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { describe, expect, it, vi } from 'vitest';

import { inset, textRoles } from '../roles.ts';
import { ThemeProvider } from '../ThemeProvider.tsx';
import { PresetButton, type PresetButtonKind } from './PresetButton.tsx';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const display = vi.hoisted(() => ({ fontScale: 1 }));
const faces = vi.hoisted(() => [] as Props[]);
const labels = vi.hoisted(() => [] as Props[]);
const fits = vi.hoisted(() => [] as Record<string, unknown>[]);

vi.mock('react-native', async (original) => {
  const actual = await original<Record<string, unknown>>();
  const { createElement: h } = await import('react');
  return {
    ...actual,
    useWindowDimensions: () => ({ fontScale: display.fontScale }),
    Pressable: (props: Props) => h('div', null, props.children),
    Text: (props: Props) => {
      labels.push(props);
      return h('span', null, props.children);
    },
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
const GROWN = 2;
const KINDS: readonly PresetButtonKind[] = ['preset', 'action'];
const ROLE = { preset: textRoles.preset, action: textRoles.presetAction };

function renderAt(fontScale: number, kind: PresetButtonKind = 'preset') {
  display.fontScale = fontScale;
  faces.length = 0;
  labels.length = 0;
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

function shownLabel(): Props | undefined {
  return labels.find((label) => label.numberOfLines !== undefined);
}

describe('PresetButton under font scale', () => {
  it('keeps the design spacing at the default scale', () => {
    expect(faceAt(1).paddingHorizontal).toBeUndefined();
    expect(faceAt(1, 'action').paddingHorizontal).toBeUndefined();
  });

  it('keeps a grown label clear of the key edge', () => {
    expect(faceAt(2).paddingHorizontal).toBe(inset.presetLabelH);
    expect(faceAt(2, 'action').paddingHorizontal).toBe(inset.presetLabelH);
  });

  it.each(KINDS)('holds the %s label to one tail-ellipsized line', (kind) => {
    renderAt(GROWN, kind);
    expect(shownLabel()).toMatchObject({
      numberOfLines: 1,
      ellipsizeMode: 'tail',
    });
  });

  it.each(KINDS)('floors the %s label at its design size when scaled', (kind) => {
    renderAt(GROWN, kind);
    expect(fits[0]).toMatchObject({ text: LABEL, role: ROLE[kind] });
    expect(Number(fits[0]?.floor) * GROWN).toBeCloseTo(ROLE[kind].size);
  });

  it.each(KINDS)('never shrinks the %s label at the default scale', (kind) => {
    renderAt(1, kind);
    expect(fits[0]?.floor).toBe(ROLE[kind].size);
  });

  it('keeps the label invisible until it is measured', () => {
    renderAt(GROWN);
    const style = StyleSheet.flatten(shownLabel()?.style as StyleProp<TextStyle>);
    expect(style.opacity).toBe(0);
  });

  it('measures the room inside the padding, not the face', () => {
    renderAt(GROWN);
    const box = faces.filter((face) => face.onLayout !== undefined);
    expect(faces[0]?.onLayout).toBeUndefined();
    expect(box).toHaveLength(1);
    const style = StyleSheet.flatten(box[0]?.style as StyleProp<ViewStyle>);
    expect(style.alignSelf).toBe('stretch');
    expect(style.paddingHorizontal).toBeUndefined();
  });
});
