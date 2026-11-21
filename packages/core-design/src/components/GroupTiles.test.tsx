import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { StyleProp, ViewStyle } from 'react-native';
import { describe, expect, it, vi } from 'vitest';

import { opacity, size } from '../roles.ts';
import { ThemeProvider } from '../ThemeProvider.tsx';
import { GroupKeys, GroupTiles, groupSumText } from './GroupTiles.tsx';
import { flatStyle } from './flatStyle.test-helper.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const views = vi.hoisted(() => [] as Props[]);
const pressables = vi.hoisted(() => [] as Props[]);

vi.mock('react-native', async (original) => {
  const actual = await original<Record<string, unknown>>();
  const View = actual.View as (props: Props) => ReactNode;
  return {
    ...actual,
    View: (props: Props) => {
      views.push(props);
      return createElement(View, props);
    },
    Pressable: (props: Props) => {
      pressables.push(props);
      return createElement('div', null, props.children);
    },
  };
});

vi.mock('./IconGlyph.tsx', () => ({ InlineIcon: () => null }));

const flat = (props: Props) => flatStyle(props.style as StyleProp<ViewStyle>);

function render(node: ReactNode) {
  views.length = 0;
  pressables.length = 0;
  return renderToStaticMarkup(
    <ThemeProvider mode="dark">{node}</ThemeProvider>,
  );
}

const belowThree = (beats: number) => beats < 3;

const tiles = () => views.filter((v) => flat(v).width === size.buttonSheet);

describe('the group tiles', () => {
  it('shows each group and a dashed slot while more can be added', () => {
    const html = render(
      <GroupTiles groups={[3, 2]} beats={5} barBeats={7} open />,
    );
    expect(tiles()).toHaveLength(3);
    expect(flat(tiles()[2] ?? {}).borderStyle).toBe('dashed');
    expect(html).toContain('5 of 7');
  });

  it('drops the slot once no group fits', () => {
    render(<GroupTiles groups={[4, 4]} beats={8} barBeats={8} open={false} />);
    expect(tiles()).toHaveLength(2);
  });

  it('sums the groups against the bar', () => {
    expect(groupSumText(6, 6)).toBe('6 of 6');
    expect(groupSumText(0, 7)).toBe('0 of 7');
  });
});

describe('the group keys', () => {
  it('labels and disables each key from its own rule', () => {
    const onAdd = vi.fn();
    render(
      <GroupKeys
        sizes={[1, 2, 3, 4]}
        canAdd={belowThree}
        canRemove={false}
        onAdd={onAdd}
        onRemove={vi.fn()}
      />,
    );
    expect(pressables.map((p) => p.accessibilityLabel)).toEqual([
      'Add a group of 1',
      'Add a group of 2',
      'Add a group of 3',
      'Add a group of 4',
      'Remove the last group',
    ]);
    expect(pressables.map((p) => p.disabled)).toEqual([
      false,
      false,
      true,
      true,
      true,
    ]);
    const faces = views.filter((v) => flat(v).minHeight === size.buttonSheet);
    expect(faces.map((f) => flat(f).opacity)).toEqual([
      undefined,
      undefined,
      opacity.muted,
      opacity.muted,
      opacity.muted,
    ]);
    (pressables[1]?.onPress as () => void)();
    expect(onAdd).toHaveBeenCalledWith(2);
  });
});
