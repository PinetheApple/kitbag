import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { StyleProp, ViewStyle } from 'react-native';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { size, space } from '../roles.ts';
import { themes } from '../theme.ts';
import { ThemeProvider } from '../ThemeProvider.tsx';
import {
  ClickBeatLegend,
  ClickBeatStrip,
  clickBeatCopy,
  clickBeatLabel,
  groupStarts,
  type ClickBeatLevel,
} from './ClickBeatStrip.tsx';
import { flatStyle } from './flatStyle.test-helper.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const views = vi.hoisted(() => [] as Props[]);
const texts = vi.hoisted(() => [] as Props[]);

vi.mock('react-native', async (original) => {
  const actual = await original<Record<string, unknown>>();
  const View = actual.View as (props: Props) => ReactNode;
  const Text = actual.Text as (props: Props) => ReactNode;
  return {
    ...actual,
    View: (props: Props) => {
      views.push(props);
      return createElement(View, props);
    },
    Text: (props: Props) => {
      texts.push(props);
      return createElement(Text, props);
    },
  };
});

const color = themes.dark.color;
const flat = (props: Props) => flatStyle(props.style as StyleProp<ViewStyle>);

const THREE_TWO_TWO: readonly (readonly ClickBeatLevel[])[] = [
  ['bar', 'click', 'click'],
  ['group', 'click'],
  ['group', 'click'],
];

function render(node: ReactNode) {
  views.length = 0;
  texts.length = 0;
  renderToStaticMarkup(<ThemeProvider mode="dark">{node}</ThemeProvider>);
}

const leds = () => views.filter((v) => flat(v).height === size.ledMain);
const halfDots = () => views.filter((v) => flat(v).height === size.ledTiny);
const numbers = () => texts.map((t) => t.children);

beforeEach(() => {
  views.length = 0;
});

describe('the beat strip', () => {
  it('draws one numbered LED per beat, counting across groups', () => {
    render(<ClickBeatStrip groups={THREE_TWO_TWO} halfBeats={false} />);
    expect(leds()).toHaveLength(7);
    expect(numbers()).toEqual(['1', '2', '3', '4', '5', '6', '7']);
  });

  it('rings both accents in accent and dots only the bar accent', () => {
    render(<ClickBeatStrip groups={[['bar'], ['group']]} halfBeats={false} />);
    const [bar, group] = leds();
    expect(flat(bar ?? {}).borderColor).toBe(color.accent);
    expect(flat(group ?? {}).borderColor).toBe(color.accent);
    expect(flat(group ?? {}).backgroundColor).toBe('transparent');
    const dots = views.filter(
      (v) => flat(v).backgroundColor === color.accent && v !== bar,
    );
    expect(dots).toHaveLength(1);
  });

  it('fills a click and dashes a silent beat', () => {
    render(<ClickBeatStrip groups={[['click', 'silent']]} halfBeats={false} />);
    const [click, silent] = leds().map(flat);
    expect(click).toMatchObject({
      backgroundColor: color.surface2,
      borderColor: color.line,
    });
    expect(silent).toMatchObject({
      borderStyle: 'dashed',
      borderColor: color.decor,
      backgroundColor: 'transparent',
    });
  });

  it('adds a half-beat dot after every beat at the tighter gaps', () => {
    render(<ClickBeatStrip groups={THREE_TWO_TWO} halfBeats />);
    expect(halfDots()).toHaveLength(7);
    const groupRows = views.filter(
      (v) => flat(v).flexDirection === 'row' && flat(v).gap === space.chipGap,
    );
    expect(groupRows).toHaveLength(3);
    const strip = views.find((v) => v.accessible === true);
    expect(flat(strip ?? {}).gap).toBe(space.ledHalfBeatGroupGap);
  });

  it('draws no half-beat dots at the plain rate', () => {
    render(<ClickBeatStrip groups={THREE_TWO_TWO} halfBeats={false} />);
    expect(halfDots()).toHaveLength(0);
  });

  it('names each beat for a screen reader', () => {
    expect(clickBeatLabel([['bar', 'silent'], ['group']], false)).toBe(
      'Beats 1 bar accent, 2 silent, 3 group accent',
    );
    expect(clickBeatLabel([['bar']], true)).toContain(clickBeatCopy.halfBeat);
  });
});

describe('group starts', () => {
  it('numbers each group from the beat after the last', () => {
    expect(groupStarts(THREE_TWO_TWO)).toEqual([1, 4, 6]);
    expect(groupStarts([])).toEqual([]);
  });
});

describe('the strip legend', () => {
  it('lists silent only at half rate and the half-beat dot only at double', () => {
    render(<ClickBeatLegend silent halfBeats={false} />);
    expect(numbers()).toEqual([
      clickBeatCopy.bar,
      clickBeatCopy.group,
      clickBeatCopy.click,
      clickBeatCopy.silent,
    ]);
    render(<ClickBeatLegend silent={false} halfBeats />);
    expect(numbers()).toEqual([
      clickBeatCopy.bar,
      clickBeatCopy.group,
      clickBeatCopy.click,
      clickBeatCopy.halfBeat,
    ]);
  });
});
