import { renderToStaticMarkup } from 'react-dom/server';
import type { ReactNode } from 'react';
import type { StyleProp, TextStyle } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { textRoles } from '../roles.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };
type Layout = (event: {
  nativeEvent: { layout: { width: number } };
}) => void;

const display = vi.hoisted(() => ({ fontScale: 1 }));
const texts = vi.hoisted(() => [] as Props[]);
const views = vi.hoisted(() => [] as Props[]);
const hookState = vi.hoisted((): { value: unknown } => ({ value: undefined }));

// Server rendering drops state updates, so this slot carries the helper's one
// useState between renders and the real layout callbacks can drive it.
vi.mock('react', async (original) => {
  const actual = await original<typeof import('react')>();
  return {
    ...actual,
    useState: (initial: () => unknown) => {
      hookState.value ??= initial();
      return [
        hookState.value,
        (update: (state: unknown) => unknown) => {
          hookState.value = update(hookState.value);
        },
      ];
    },
  };
});

vi.mock('react-native', async (original) => {
  const actual = await original<Record<string, unknown>>();
  const { createElement: h } = await import('react');
  return {
    ...actual,
    useWindowDimensions: () => ({
      fontScale: display.fontScale,
      scale: 1,
    }),
    Text: (props: Props) => {
      texts.push(props);
      return h('span', null, props.children);
    },
    View: (props: Props) => {
      views.push(props);
      return h('div', null, props.children);
    },
  };
});

const { StyleSheet } = await import('react-native');
const { DesignFloorOneLineText } =
  await import('./DesignFloorOneLineText.tsx');

const ROLE = textRoles.preset;
const LABEL = '−10';
const GROWN_FONT_SCALE = 2;
const ROOM = 40;
const OVERFLOWING = 46;
const FITTING = 39;
const FAR_TOO_WIDE = 400;
const LABEL_STYLE = { color: 'labelInk' };
const BOX_STYLE = { alignSelf: 'stretch' } as const;

function render() {
  texts.length = 0;
  views.length = 0;
  renderToStaticMarkup(
    <DesignFloorOneLineText
      text={LABEL}
      role={ROLE}
      style={LABEL_STYLE}
      boxStyle={BOX_STYLE}
    />,
  );
}

function fire(layout: unknown, width: number) {
  (layout as Layout)({ nativeEvent: { layout: { width } } });
  render();
}

function box(): Props | undefined {
  return views.find((view) => view.onLayout !== undefined);
}

function measurer(): Props | undefined {
  return texts.find((text) => text.onLayout !== undefined);
}

function shown(): Props | undefined {
  return texts.find((text) => text.numberOfLines !== undefined);
}

function shownStyle(): TextStyle {
  return StyleSheet.flatten(shown()?.style as StyleProp<TextStyle>);
}

function measurerStyle(): TextStyle {
  return StyleSheet.flatten(measurer()?.style as StyleProp<TextStyle>);
}

function settle(fontScale: number, ...widths: readonly number[]) {
  display.fontScale = fontScale;
  render();
  fire(box()?.onLayout, ROOM);
  for (const width of widths) fire(measurer()?.onLayout, width);
}

describe('DesignFloorOneLineText', () => {
  beforeEach(() => {
    hookState.value = undefined;
  });

  it('holds the text to one tail-ellipsized line', () => {
    settle(GROWN_FONT_SCALE);
    expect(shown()).toMatchObject({ numberOfLines: 1, ellipsizeMode: 'tail' });
    expect(shown()?.children).toBe(LABEL);
  });

  it('keeps the text invisible until it is measured', () => {
    settle(GROWN_FONT_SCALE);
    expect(shownStyle().opacity).toBe(0);
  });

  it('shows the text at the settled size once both layouts report', () => {
    settle(GROWN_FONT_SCALE, OVERFLOWING, FITTING);
    expect(shownStyle().opacity).toBeUndefined();
    expect(shownStyle().fontSize).toBeCloseTo((ROLE.size * ROOM) / OVERFLOWING);
  });

  it('shows text that never fits at the design-size floor when scaled', () => {
    settle(GROWN_FONT_SCALE, FAR_TOO_WIDE, FAR_TOO_WIDE);
    expect(shownStyle().opacity).toBeUndefined();
    expect(shownStyle().fontSize).toBeCloseTo(ROLE.size / GROWN_FONT_SCALE);
  });

  it('never shrinks the text at the default scale', () => {
    settle(1, FAR_TOO_WIDE);
    expect(shownStyle().opacity).toBeUndefined();
    expect(shownStyle().fontSize).toBe(ROLE.size);
  });

  it('measures the text in the style it is shown in', () => {
    settle(GROWN_FONT_SCALE);
    expect(measurerStyle().color).toBe(LABEL_STYLE.color);
    expect(shownStyle().color).toBe(LABEL_STYLE.color);
  });

  it('fits to the box the caller styles', () => {
    settle(GROWN_FONT_SCALE);
    expect(box()?.style).toBe(BOX_STYLE);
  });
});
