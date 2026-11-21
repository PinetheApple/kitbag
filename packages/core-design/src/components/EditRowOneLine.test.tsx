import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import { describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '../ThemeProvider.tsx';
import { flatStyle } from './flatStyle.test-helper.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const views = vi.hoisted(() => [] as Props[]);
const texts = vi.hoisted(() => [] as Props[]);

vi.mock('react-native', async (importOriginal) => {
  const { createElement: h } = await import('react');
  return {
    ...(await importOriginal<typeof import('react-native')>()),
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

vi.mock('./IconGlyph.tsx', () => ({ IconGlyph: () => 'chevron' }));

const { EditRow, EditValue } = await import('./EditRow.tsx');

const VALUE = 'github.com/owner/repository';
const noop = () => undefined;

function render(singleLine: boolean) {
  views.length = 0;
  texts.length = 0;
  renderToStaticMarkup(
    <ThemeProvider mode="dark">
      <EditRow label="Source" singleLine={singleLine} onPress={noop}>
        <EditValue oneLine>{VALUE}</EditValue>
      </EditRow>
    </ThemeProvider>,
  );
  const valueBox = views.find(
    (view) =>
      flatStyle(view.style as StyleProp<ViewStyle>).justifyContent ===
      'flex-end',
  );
  const value = texts.find((text) => text.children === VALUE);
  return {
    box: flatStyle(valueBox?.style as StyleProp<ViewStyle>),
    value,
    valueStyle: flatStyle(value?.style as StyleProp<TextStyle>),
  };
}

describe('a one-line value in a pressable row', () => {
  it('keeps the value and its chevron on one line in a single-line row', () => {
    expect(render(true).box.flexWrap).toBe('nowrap');
  });

  it('lets a row that may wrap still wrap its value', () => {
    expect(render(false).box.flexWrap).toBe('wrap');
  });

  it('shrinks the value to the room left and ends it with an ellipsis', () => {
    const { value, valueStyle } = render(true);
    expect(value).toMatchObject({ numberOfLines: 1, ellipsizeMode: 'tail' });
    expect(valueStyle.flexShrink).toBe(1);
  });
});
