// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act, type ReactNode } from 'react';
import type { StyleProp, TextStyle, ViewStyle } from 'react-native';
import {
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '../ThemeProvider.tsx';
import { flatStyle } from './flatStyle.test-helper.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

vi.mock('react-native', async (importOriginal) => {
  const { createElement: h } = await import('react');
  return {
    ...(await importOriginal<typeof import('react-native')>()),
    View: (props: Props) => h('View', props),
    Text: (props: Props) => h('Text', props),
    Pressable: (props: Props) => h('Pressable', props),
  };
});

vi.mock('./IconGlyph.tsx', () => ({ IconGlyph: () => null }));

const { EditRow, EditValue } = await import('./EditRow.tsx');

const VALUE = 'github.com/owner/repository';
const noop = () => undefined;

function hostParent(node: ReactTestInstance): ReactTestInstance | null {
  let parent = node.parent;
  while (parent !== null && String(parent.type) !== 'View')
    parent = parent.parent;
  return parent;
}

function render(singleLine: boolean) {
  let renderer: ReactTestRenderer | undefined;
  act(() => {
    renderer = create(
      <ThemeProvider mode="dark">
        <EditRow label="Source" singleLine={singleLine} onPress={noop}>
          <EditValue oneLine ellipsizeMode="middle">
            {VALUE}
          </EditValue>
        </EditRow>
      </ThemeProvider>,
    );
  });
  const value = renderer?.root.find(
    (node) => String(node.type) === 'Text' && node.props.children === VALUE,
  );
  if (value === undefined) throw new Error('value not rendered');
  const box = hostParent(value);
  return {
    box: flatStyle(box?.props.style as StyleProp<ViewStyle>),
    value: value.props as Props,
    valueStyle: flatStyle(value.props.style as StyleProp<TextStyle>),
  };
}

describe('a one-line value in a pressable row', () => {
  it('keeps the value and its chevron on one line in a single-line row', () => {
    expect(render(true).box.flexWrap).toBe('nowrap');
  });

  it('lets a row that may wrap still wrap its value', () => {
    expect(render(false).box.flexWrap).toBe('wrap');
  });

  it('shrinks the value to the room left and cuts it where asked', () => {
    const { value, valueStyle } = render(true);
    expect(value).toMatchObject({ numberOfLines: 1, ellipsizeMode: 'middle' });
    expect(valueStyle.flexShrink).toBe(1);
  });
});
