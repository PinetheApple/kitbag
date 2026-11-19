import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { StyleProp, ViewStyle } from 'react-native';
import { describe, expect, it, vi } from 'vitest';

import { opacity, radius, size, space } from '../roles.ts';
import { wrappedRowGap } from '../segmentHitBox.ts';
import { ThemeProvider } from '../ThemeProvider.tsx';
import { minTouchTargetDp } from '../tokens.ts';
import {
  SegmentedControl,
  type SegmentedControlSize,
} from './SegmentedControl.tsx';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const display = vi.hoisted(() => ({ fontScale: 1 }));
const rendered = vi.hoisted(() => ({
  track: [] as Props[],
  options: [] as Props[],
}));

vi.mock('react-native', async (original) => {
  const actual = await original<Record<string, unknown>>();
  const View = actual.View as (props: Props) => ReactNode;
  return {
    ...actual,
    useWindowDimensions: () => ({ fontScale: display.fontScale }),
    View: (props: Props) => {
      if (props.accessibilityRole === 'radiogroup') rendered.track.push(props);
      return createElement(View, props);
    },
    Pressable: (props: Props) => {
      rendered.options.push(props);
      return createElement('div', null, props.children);
    },
  };
});

const { StyleSheet } = await import('react-native');

const OPTIONS = [
  { value: 'same', label: 'Same' },
  { value: 'distinct', label: 'Distinct' },
] as const;

const WITH_DISABLED = [
  { value: 'same', label: 'Same' },
  { value: 'distinct', label: 'Distinct', disabled: true },
] as const;

const FLEX_SIZES: readonly SegmentedControlSize[] = [
  'default',
  'large',
  'tab',
  'picker',
];
const CONTENT_SIZES: readonly SegmentedControlSize[] = [
  'inline',
  'editRow',
  'row',
];

function flat(props: Props | undefined): ViewStyle {
  return StyleSheet.flatten(props?.style as StyleProp<ViewStyle>);
}

function renderAt(
  fontScale: number,
  size: SegmentedControlSize,
  fill = true,
  neighbourGapDp: number = space.segmentInset,
) {
  display.fontScale = fontScale;
  rendered.track.length = 0;
  rendered.options.length = 0;
  renderToStaticMarkup(
    <ThemeProvider mode="dark">
      <SegmentedControl
        size={size}
        fill={fill}
        neighbourGapDp={neighbourGapDp}
        accessibilityLabel="Count-in sound"
        options={OPTIONS}
        selected="same"
        onSelect={vi.fn()}
      />
    </ThemeProvider>,
  );
  return {
    track: flat(rendered.track[0]),
    options: rendered.options.map(flat),
    faces: rendered.options.map((option) =>
      flat((option.children as { props: Props }).props),
    ),
  };
}

describe('SegmentedControl option face', () => {
  it('keeps a native view for every option, selected or not', () => {
    for (const size of [...FLEX_SIZES, ...CONTENT_SIZES]) {
      renderAt(1, size);
      expect(rendered.options).toHaveLength(OPTIONS.length);
      for (const option of rendered.options) {
        const face = option.children as { props: Props };
        expect(face.props.collapsable).toBe(false);
      }
    }
  });
});

describe('SegmentedControl under font scale', () => {
  it('shares the track out equally at the default text size', () => {
    const { track, options } = renderAt(1, 'large');
    expect(track.flexWrap).toBeUndefined();
    for (const option of options) expect(option.flex).toBe(1);
  });

  it('never shrinks a flex option below its label once the text grows', () => {
    for (const size of FLEX_SIZES) {
      for (const fill of [true, false]) {
        const { options } = renderAt(2, size, fill);
        for (const option of options) {
          expect(option.flex).toBeUndefined();
          expect(option.flexShrink ?? 0).toBe(0);
        }
      }
    }
  });

  it('leaves content-sized options to the platform default of no shrink', () => {
    for (const size of CONTENT_SIZES) {
      for (const option of renderAt(2, size).options) {
        expect(option.flex).toBeUndefined();
        expect(option.flexShrink).toBeUndefined();
      }
    }
  });

  it('wraps options onto further rows inside the track once the text grows', () => {
    for (const size of [...FLEX_SIZES, ...CONTENT_SIZES]) {
      const { track } = renderAt(2, size);
      expect(track.flexWrap).toBe('wrap');
      expect(track.rowGap).toBe(wrappedRowGap(size));
    }
  });

  it('gives a single row of large options the minimum target', () => {
    const { options, faces } = renderAt(2, 'large', true, space.controlGap);
    options.forEach((option, i) => {
      const face = Number(faces[i]?.minHeight);
      const reach = Number(option.paddingTop) + Number(option.paddingBottom);
      expect(face + reach).toBeGreaterThanOrEqual(minTouchTargetDp);
    });
  });

  it('gives a tab option its drawn height and the minimum target', () => {
    const { options, faces } = renderAt(1, 'tab', true, space.controlGap);
    options.forEach((option, i) => {
      expect(faces[i]?.minHeight).toBe(size.segmentTabOption);
      const reach = Number(option.paddingTop) + Number(option.paddingBottom);
      expect(size.segmentTabOption + reach).toBeGreaterThanOrEqual(
        minTouchTargetDp,
      );
    });
  });

  it('draws a picker track at the minimum target on a neutral selected face', async () => {
    const { themes } = await import('../theme.ts');
    const { track, faces } = renderAt(1, 'picker');
    const edges = Number(track.padding) + Number(track.borderWidth);
    expect(Number(faces[0]?.minHeight) + edges * 2).toBe(minTouchTargetDp);
    expect(track.borderRadius).toBe(radius.segmentLarge);
    expect(faces[0]).toMatchObject({
      borderRadius: radius.segmentLargeOption,
      backgroundColor: themes.dark.color.surface3,
    });
  });

  it('lets a filling track shrink to its line so its options wrap', () => {
    const { track } = renderAt(2, 'large');
    expect(track.flex).toBeUndefined();
    expect(track.flexShrink).toBe(1);
  });
});

function renderOptions(
  options: readonly { value: string; label: string; disabled?: boolean }[],
  onSelect: (value: string) => void,
) {
  display.fontScale = 1;
  rendered.options.length = 0;
  renderToStaticMarkup(
    <ThemeProvider mode="dark">
      <SegmentedControl
        size="large"
        accessibilityLabel="Tempo"
        options={options}
        selected="same"
        onSelect={onSelect}
      />
    </ThemeProvider>,
  );
  return rendered.options;
}

const press = (option: Props | undefined) => {
  (option?.onPress as (() => void) | undefined)?.();
};

describe('SegmentedControl disabled option', () => {
  it('refuses a tap, so the selection cannot move onto it', () => {
    const onSelect = vi.fn();
    const [, disabled] = renderOptions(WITH_DISABLED, onSelect);
    press(disabled);
    expect(onSelect).not.toHaveBeenCalled();
    expect(disabled?.disabled).toBe(true);
  });

  it('reports itself disabled and draws muted', () => {
    const [enabled, disabled] = renderOptions(WITH_DISABLED, vi.fn());
    expect(disabled?.accessibilityState).toEqual({
      checked: false,
      disabled: true,
    });
    expect(flat(disabled).opacity).toBe(opacity.muted);
    expect(enabled?.accessibilityState).toEqual({ checked: true });
    expect(flat(enabled).opacity).toBeUndefined();
  });

  it('leaves every option as it was without the flag', () => {
    const onSelect = vi.fn();
    const [, distinct] = renderOptions(OPTIONS, onSelect);
    press(distinct);
    expect(onSelect).toHaveBeenCalledWith('distinct');
    expect(distinct?.disabled).toBeUndefined();
    expect(distinct?.accessibilityState).toEqual({ checked: false });
    expect(flat(distinct).opacity).toBeUndefined();
  });
});

describe('SegmentedControl two-line option', () => {
  const TWO_LINE = [
    { value: 'half', label: '÷2', detail: '52', accessibilityLabel: 'Half' },
    { value: 'one', label: '×1', detail: '104' },
  ] as const;

  it('draws the second line under the label and speaks the option label', () => {
    display.fontScale = 1;
    rendered.options.length = 0;
    const markup = renderToStaticMarkup(
      <ThemeProvider mode="dark">
        <SegmentedControl
          size="picker"
          accessibilityLabel="Tempo correction"
          options={TWO_LINE}
          selected="one"
          onSelect={vi.fn()}
        />
      </ThemeProvider>,
    );
    expect(markup.indexOf('÷2')).toBeLessThan(markup.indexOf('52'));
    expect(markup).toContain('104');
    expect(rendered.options.map((o) => o.accessibilityLabel)).toEqual([
      'Half',
      '×1',
    ]);
  });
});
