import { type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { StyleProp, ViewStyle } from 'react-native';
import { describe, expect, it, vi } from 'vitest';

import { inset, textRoles } from '../roles.ts';
import { themes } from '../theme.ts';
import { ThemeProvider } from '../ThemeProvider.tsx';
import { PresetButton, type PresetButtonKind } from './PresetButton.tsx';
import { flatStyle } from './flatStyle.test-helper.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const display = vi.hoisted(() => ({ fontScale: 1 }));
const faces = vi.hoisted(() => [] as Props[]);
const fits = vi.hoisted(() => [] as Record<string, unknown>[]);
const presses = vi.hoisted(() => [] as Props[]);

vi.mock('react-native', async (original) => {
  const actual = await original<Record<string, unknown>>();
  const { createElement: h } = await import('react');
  return {
    ...actual,
    useWindowDimensions: () => ({ fontScale: display.fontScale }),
    Pressable: (props: Props) => {
      presses.push(props);
      return h('div', null, props.children);
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

const LABEL = '−10';
const GROWN_FONT_SCALE = 2;
const KINDS: readonly PresetButtonKind[] = ['preset', 'action'];
const ROLE = { preset: textRoles.preset, action: textRoles.presetAction };

function renderAt(
  fontScale: number,
  kind: PresetButtonKind = 'preset',
  selected = false,
) {
  display.fontScale = fontScale;
  faces.length = 0;
  fits.length = 0;
  renderToStaticMarkup(
    <ThemeProvider mode="dark">
      <PresetButton
        kind={kind}
        label={LABEL}
        selected={selected}
        onPress={vi.fn()}
      />
    </ThemeProvider>,
  );
}

function faceAt(
  fontScale: number,
  kind: PresetButtonKind = 'preset',
): ViewStyle {
  renderAt(fontScale, kind);
  return flatStyle(faces[0]?.style as StyleProp<ViewStyle>);
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
    const style = flatStyle(box[0]?.style as StyleProp<ViewStyle>);
    expect(style.alignSelf).toBe('stretch');
    expect(style.paddingHorizontal).toBeUndefined();
  });
});

describe('PresetButton selected', () => {
  it('takes the active fill and border only when selected', () => {
    const { activeControlFill, color } = themes.dark;
    const face = () => flatStyle(faces[0]?.style as StyleProp<ViewStyle>);
    renderAt(1, 'preset', true);
    expect(face()).toMatchObject({
      backgroundColor: activeControlFill,
      borderColor: color.accentDim,
    });
    renderAt(1);
    expect(face().backgroundColor).toBe(color.surface2);
  });
});

it('fires a press-in key on touch-down with the touch event', () => {
  const onPressIn = vi.fn();
  const event = { nativeEvent: { timestamp: 1 } };
  presses.length = 0;
  renderToStaticMarkup(
    <ThemeProvider mode="dark">
      <PresetButton kind="action" label={LABEL} onPressIn={onPressIn} />
    </ThemeProvider>,
  );
  expect(presses[0]?.onPress).toBeUndefined();
  (presses[0]?.onPressIn as (pressed: unknown) => void)(event);
  expect(onPressIn).toHaveBeenCalledWith(event);
});
