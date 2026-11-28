// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { act, type ReactElement } from 'react';
import { StyleSheet, type ViewStyle } from 'react-native';
import {
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from 'react-test-renderer';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { ThemeProvider } from '../ThemeProvider.tsx';

const scale = vi.hoisted(() => ({ scaled: false }));

vi.mock('react-native', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  View: 'View',
  Pressable: 'Pressable',
}));
vi.mock('../useTextScaled.ts', () => ({ useTextScaled: () => scale.scaled }));
vi.mock('./Icon.tsx', () => ({ Icon: () => null }));
vi.mock('./EllipsizedText.tsx', () => ({ EllipsizedText: 'Text' }));

const { ListRow } = await import('./ListRow.tsx');
const { PlainListRow } = await import('./PlainListRow.tsx');

const TITLE = 'Jazz standards';
const MORE_LABEL = `Actions for ${TITLE}`;
const DESIGN_GAP_BEFORE_MORE_DP = 6;
const DESIGN_MORE_TO_INNER_EDGE_DP = 4;
const ignore = () => undefined;

function render(row: ReactElement): ReactTestRenderer {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(<ThemeProvider mode="dark">{row}</ThemeProvider>);
  });
  if (tree === undefined) throw new Error('not mounted');
  return tree;
}

const flat = (node: ReactTestInstance): ViewStyle =>
  StyleSheet.flatten(node.props.style as ViewStyle) ?? {};

function hostParent(node: ReactTestInstance): ReactTestInstance {
  let up = node.parent;
  while (up !== null && typeof up.type !== 'string') up = up.parent;
  if (up === null) throw new Error('no host parent');
  return up;
}

function more(tree: ReactTestRenderer): ReactTestInstance {
  return tree.root.find(
    (n) =>
      n.type === ('Pressable' as never) &&
      n.props.accessibilityLabel === MORE_LABEL,
  );
}

function endPadding(style: ViewStyle): number {
  const end = style.paddingRight ?? style.paddingHorizontal ?? style.padding;
  return typeof end === 'number' ? end : 0;
}

function BadgeStub() {
  return null;
}
const badge = <BadgeStub />;

const rows: readonly [string, () => ReactElement][] = [
  [
    'setlist row',
    () => (
      <ListRow
        icon="songs"
        title={TITLE}
        subtitle="6 songs"
        badges={badge}
        onPress={ignore}
        onActions={ignore}
      />
    ),
  ],
  [
    'entry row',
    () => (
      <PlainListRow
        title={TITLE}
        subtitle="6 songs"
        badges={badge}
        accessibilityLabel={TITLE}
        onPress={ignore}
        onActions={ignore}
      />
    ),
  ],
];

beforeEach(() => {
  scale.scaled = false;
});

describe.each(rows)('%s actions button', (_name, row) => {
  it('sits the design gap from the row body and the design inset from the card edge', () => {
    const button = more(render(row()));
    const own = flat(button);
    const card = flat(hostParent(button));
    expect(Number(card.gap) + Number(own.marginLeft)).toBe(
      DESIGN_GAP_BEFORE_MORE_DP,
    );
    expect(endPadding(card) + Number(own.marginRight)).toBe(
      DESIGN_MORE_TO_INNER_EDGE_DP,
    );
  });

  it('keeps badges beside the text, then drops them under the facts when text is scaled', () => {
    const textColumn = (tree: ReactTestRenderer) =>
      tree.root
        .findAll(
          (n) => n.type === ('Text' as never) && n.props.children === TITLE,
        )
        .map(hostParent)[0];
    const holds = (node: ReactTestInstance | undefined) =>
      node?.findAll((n) => n.type === (BadgeStub as never)).length ?? 0;
    expect(holds(textColumn(render(row())))).toBe(0);
    scale.scaled = true;
    const scaled = render(row());
    expect(holds(textColumn(scaled))).toBe(1);
    expect(more(scaled)).toBeDefined();
  });
});
