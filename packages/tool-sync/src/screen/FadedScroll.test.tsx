// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import {
  act,
  forwardRef,
  useImperativeHandle,
  type ReactNode,
  type Ref,
} from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const flash = vi.hoisted(() => vi.fn());

vi.mock('react-native', async () => {
  const { createElement: h } = await import('react');
  function ScrollView(props: Props, ref: Ref<unknown>) {
    useImperativeHandle(ref, () => ({ flashScrollIndicators: flash }));
    return h('ScrollView', props);
  }
  return { View: 'View', ScrollView: forwardRef(ScrollView) };
});

vi.mock('@kitbag/core-design', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  createThemedStyles: () => () => ({}),
}));

const { FadedScroll } = await import('./FadedScroll.tsx');

const VIEWPORT = 380;
const OVERFLOWING = 520;

function mount(): ReactTestRenderer {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(<FadedScroll overlay={null}>cards</FadedScroll>);
  });
  if (tree === undefined) throw new Error('nothing rendered');
  return tree;
}

function scrollProps(tree: ReactTestRenderer): Props {
  return tree.root.findByType('ScrollView' as never).props;
}

function measure(tree: ReactTestRenderer, content: number): void {
  const props = scrollProps(tree) as Props & {
    readonly onLayout: (event: unknown) => void;
    readonly onContentSizeChange: (width: number, height: number) => void;
  };
  act(() => {
    props.onLayout({ nativeEvent: { layout: { height: VIEWPORT } } });
    props.onContentSizeChange(0, content);
  });
}

beforeEach(() => {
  flash.mockClear();
});

describe('the play along scroll body', () => {
  it('shows the scroll indicator once the content overflows', () => {
    const tree = mount();
    measure(tree, OVERFLOWING);
    expect(scrollProps(tree).showsVerticalScrollIndicator).toBe(true);
    expect(scrollProps(tree).persistentScrollbar).toBe(true);
  });

  it('redraws the indicator when overflow starts, since Android does not on the prop', () => {
    const tree = mount();
    measure(tree, OVERFLOWING);
    expect(flash).toHaveBeenCalledTimes(1);
  });

  it('draws no indicator while the content fits', () => {
    const tree = mount();
    measure(tree, VIEWPORT);
    expect(scrollProps(tree).showsVerticalScrollIndicator).toBe(false);
    expect(flash).not.toHaveBeenCalled();
  });
});
