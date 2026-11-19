// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import type { MoveStatus } from '@kitbag/core-native';
import type { DataFolderStore } from '@kitbag/core-state';
import { act, createElement } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { useStore } from 'zustand';
import type { StoreApi } from 'zustand/vanilla';
import { describe, expect, it, vi } from 'vitest';

import { move } from '../settings/dataFolderMove.test-helper.ts';
import { fakeFolder } from './dataFolder.test-helper.ts';

const world = vi.hoisted(() => ({
  store: null as StoreApi<DataFolderStore> | null,
}));

vi.mock('react-native', () => ({ View: 'View', Text: 'Text' }));

vi.mock('@kitbag/core-design', async (original) => {
  const { hostMock } = await import('./dataFolder.test-helper.ts');
  return {
    ...(await original<Record<string, unknown>>()),
    Card: hostMock('Card'),
    Icon: () => null,
    Button: hostMock('Button'),
    useTextScaled: () => false,
    useTheme: () => ({ accentInk: 'accent' }),
    createThemedStyles: () => () => ({}),
  };
});

vi.mock('@kitbag/core-state', async (original) => {
  const real = await original<Record<string, unknown>>();
  const current = () => {
    if (world.store === null) throw new Error('no store');
    return world.store;
  };
  return {
    ...real,
    get dataFolderStore() {
      return current();
    },
    useDataFolder: <T>(select: (state: DataFolderStore) => T) =>
      useStore(current(), select),
  };
});

const { MovePausedBanner } = await import('./MovePausedBanner.tsx');
const { CARD_OUT } = await import('./dataFolder.test-helper.ts');

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const KILLED = move({ running: false, paused: true });

async function mount(status: MoveStatus | null) {
  const folder = fakeFolder({ ...CARD_OUT, currentAvailable: true }, status);
  world.store = folder.store;
  await folder.store.getState().start();
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(createElement(MovePausedBanner));
  });
  if (tree === undefined) throw new Error('not mounted');
  return { ...folder, tree };
}

const texts = (tree: ReactTestRenderer) =>
  tree.root
    .findAllByType('Text' as never)
    .map((node) => String((node.props as { children: unknown }).children));

async function press(tree: ReactTestRenderer, label: string) {
  const found = tree.root
    .findAllByType('Button' as never)
    .find((node) => (node.props as { label: string }).label === label);
  if (found === undefined) throw new Error(`no ${label} button`);
  await act(async () => {
    (found.props as { onPress: () => void }).onPress();
    await Promise.resolve();
  });
}

describe('the Home banner for a move the app was closed in', () => {
  it('says how far the move got, with Undo and Resume', async () => {
    const { tree } = await mount(KILLED);
    expect(texts(tree)).toEqual([
      'Move to SD card paused',
      'Kitbag closed during the move. 24 of 54 files are on the SD card. Your songs still play from internal storage.',
    ]);
  });

  it('resumes the move', async () => {
    const { tree, native } = await mount(KILLED);
    await press(tree, 'Resume');
    expect(native.resumeMove).toHaveBeenCalledOnce();
  });

  it('undoes the move', async () => {
    const { tree, native } = await mount(KILLED);
    await press(tree, 'Undo');
    expect(native.undoMove).toHaveBeenCalledOnce();
  });

  it('never shows for a move that failed', async () => {
    const { tree } = await mount({ ...KILLED, error: 'E_MOVE_HASH_MISMATCH' });
    expect(tree.toJSON()).toBeNull();
  });

  it.each([
    ['running', move()],
    ['switched', move({ running: false, switched: true })],
    ['absent', null],
  ])('never shows for a move that is %s', async (_state, status) => {
    const { tree } = await mount(status);
    expect(tree.toJSON()).toBeNull();
  });
});
