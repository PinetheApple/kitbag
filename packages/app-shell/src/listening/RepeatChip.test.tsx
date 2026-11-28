// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import { REPEAT, repeatStore } from '@kitbag/core-state';
import { act, createElement } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@kitbag/core-design', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  Chip: 'Chip',
}));

const { RepeatChip } = await import('./RepeatChip.tsx');

afterEach(() => {
  repeatStore.setState({ mode: REPEAT.off });
});

function chipOf(tree: ReactTestRenderer) {
  const chip = tree.root.findByType('Chip' as never);
  return {
    face: [chip.props.label, chip.props.icon, chip.props.active] as const,
    press: chip.props.onPress as () => void,
  };
}

function rendered(): ReactTestRenderer {
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(createElement(RepeatChip));
  });
  if (tree === undefined) throw new Error('not rendered');
  return tree;
}

describe('the repeat chip', () => {
  it('cycles Repeat off, Repeat all and Repeat one, lit while on', () => {
    const tree = rendered();
    const faces = [chipOf(tree).face];
    for (let press = 0; press < 3; press++) {
      act(() => {
        chipOf(tree).press();
      });
      faces.push(chipOf(tree).face);
    }
    expect(faces).toEqual([
      ['Repeat off', 'repeatOff', false],
      ['Repeat all', 'repeat', true],
      ['Repeat one', 'repeatOne', true],
      ['Repeat off', 'repeatOff', false],
    ]);
  });
});
