import { renderToStaticMarkup } from 'react-dom/server';
import type { StyleProp, ViewStyle } from 'react-native';
import { describe, expect, it, vi } from 'vitest';

import { themes } from '../theme.ts';
import { ThemeProvider } from '../ThemeProvider.tsx';
import { Card } from './Card.tsx';
import { flatStyle } from './flatStyle.test-helper.ts';

type Props = Record<string, unknown> & { readonly children?: unknown };

const boxes = vi.hoisted(() => [] as Props[]);

vi.mock('react-native', async (original) => {
  const actual = await original<Record<string, unknown>>();
  const { createElement: h } = await import('react');
  return {
    ...actual,
    View: (props: Props) => {
      boxes.push(props);
      return h('div', null, props.children as never);
    },
  };
});

vi.mock('./Icon.tsx', () => ({ Icon: () => null }));

function cardBorder(warning: boolean): ViewStyle['borderColor'] {
  boxes.length = 0;
  renderToStaticMarkup(
    <ThemeProvider mode="dark">
      <Card {...(warning ? { borderTone: 'warning' as const } : {})}>x</Card>
    </ThemeProvider>,
  );
  return flatStyle(boxes[0]?.style as StyleProp<ViewStyle>).borderColor;
}

describe('a card with a border tone', () => {
  it('draws the warning border with no status icon', () => {
    expect(cardBorder(true)).toBe(themes.dark.feedback.warning.cardBorder);
    expect(boxes).toHaveLength(1);
  });

  it('keeps the line border without one', () => {
    expect(cardBorder(false)).toBe(themes.dark.color.line);
  });
});
