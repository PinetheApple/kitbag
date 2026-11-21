import type { ReactNode } from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '../ThemeProvider.tsx';
import { flatStyle } from './flatStyle.test-helper.ts';
import { SectionHeader } from './SectionHeader.tsx';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const scale = vi.hoisted(() => ({ scaled: false }));
const views = vi.hoisted(() => [] as Props[]);
const texts = vi.hoisted(() => [] as Props[]);

vi.mock('../useTextScaled.ts', () => ({ useTextScaled: () => scale.scaled }));

vi.mock('react-native', async (original) => {
  const actual = await original<Record<string, unknown>>();
  const { createElement: h } = await import('react');
  return {
    ...actual,
    View: (props: Props) => {
      views.push(props);
      return h('div', null, props.children);
    },
    Text: (props: Props) => {
      texts.push(props);
      return h('span', null, props.children);
    },
  };
});

function layoutAt(scaled: boolean) {
  scale.scaled = scaled;
  views.length = 0;
  texts.length = 0;
  renderToStaticMarkup(
    <ThemeProvider mode="dark">
      <SectionHeader label="Next in queue" action={<span />} />
    </ThemeProvider>,
  );
  return {
    row: flatStyle(views[0]?.style as StyleProp<ViewStyle>),
    label: flatStyle(texts[0]?.style as StyleProp<TextStyle>),
  };
}

describe('SectionHeader with an action', () => {
  it('shrinks the label beside the action at the design size', () => {
    const { row, label } = layoutAt(false);
    expect(row.flexWrap).toBeUndefined();
    expect(label.flexShrink).toBe(1);
  });

  it('wraps the action under a label that keeps its width when text is scaled', () => {
    const { row, label } = layoutAt(true);
    expect(row.flexWrap).toBe('wrap');
    expect(label.flexShrink).toBeUndefined();
  });
});
