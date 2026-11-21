import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { StyleProp, ViewStyle } from 'react-native';
import { describe, expect, it, vi } from 'vitest';

import { libraryList } from '../libraryRoles.ts';
import { space } from '../roles.ts';
import { ThemeProvider } from '../ThemeProvider.tsx';
import {
  FloatingActionButton,
  type FloatingActionButtonVariant,
} from './FloatingActionButton.tsx';
import { flatStyle } from './flatStyle.test-helper.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const PHONE_WIDTH = 411;
const TABLET_WIDTH = 800;

const drawn = vi.hoisted(() => ({
  width: 0,
  presses: [] as Props[],
}));

vi.mock('react-native', async (original) => {
  const actual = await original<Record<string, unknown>>();
  const Pressable = actual.Pressable as (props: Props) => ReactNode;
  return {
    ...actual,
    useWindowDimensions: () => ({ width: drawn.width, fontScale: 1, scale: 1 }),
    Pressable: (props: Props) => {
      drawn.presses.push(props);
      return createElement(Pressable, props);
    },
  };
});

vi.mock('./Icon.tsx', () => ({ Icon: () => null }));

function drawFab(width: number, variant: FloatingActionButtonVariant) {
  drawn.width = width;
  drawn.presses.length = 0;
  renderToStaticMarkup(
    <ThemeProvider mode="dark">
      <FloatingActionButton
        icon="add"
        accessibilityLabel="Add"
        variant={variant}
        onPress={vi.fn()}
      />
    </ThemeProvider>,
  );
  return flatStyle(drawn.presses[0]?.style as StyleProp<ViewStyle>);
}

describe('FloatingActionButton end edge', () => {
  it('keeps the phone end gap for a list FAB at phone width', () => {
    expect(drawFab(PHONE_WIDTH, 'list').right).toBe(libraryList.fabEnd);
  });

  it('pulls a list FAB in to the content inset when the column is capped', () => {
    expect(drawFab(TABLET_WIDTH, 'list').right).toBe(space.screenInset);
  });

  it('leaves a default FAB to its parent at any width', () => {
    expect(drawFab(TABLET_WIDTH, 'default').right).toBeUndefined();
  });
});
