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
import { CARD_OUT, fakeFolder, refusal } from './dataFolder.test-helper.ts';

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
    RowIcon: () => null,
    Button: hostMock('Button'),
    ButtonRow: hostMock('ButtonRow'),
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

function button(tree: ReactTestRenderer, label: string) {
  const found = tree.root
    .findAllByType('Button' as never)
    .find((node) => (node.props as { label: string }).label === label);
  if (found === undefined) throw new Error(`no ${label} button`);
  return found;
}

async function press(tree: ReactTestRenderer, label: string) {
  const found = button(tree, label);
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

describe('the banner for a return whose card was taken out', () => {
  const CARD_TAKEN = move({
    running: false,
    paused: true,
    sourceVolumeUuid: CARD_OUT.currentVolumeUuid,
    targetVolumeUuid: null,
    cardReturn: true,
  });

  it('asks for the card and holds Resume until it is back', async () => {
    const { tree } = await mount(CARD_TAKEN);
    expect(texts(tree)).toEqual([
      'Move to internal storage paused',
      'SD card taken out. 24 of 54 files are on internal storage. Put the card back to resume, or undo to remove those copies. Its songs play again once it’s in.',
    ]);
    expect(
      (button(tree, 'Resume').props as { disabled: boolean }).disabled,
    ).toBe(true);
    expect((button(tree, 'Undo').props as { disabled: boolean }).disabled).toBe(
      false,
    );
  });
});

describe('a refused banner action', () => {
  it('says why Resume was refused', async () => {
    const { tree, native } = await mount(KILLED);
    native.resumeMove.mockRejectedValueOnce(
      refusal('E_MOVE_TARGET_UNAVAILABLE'),
    );
    await press(tree, 'Resume');
    await vi.waitFor(() => {
      expect(texts(tree)).toContain(
        'Kitbag lost the SD card and stopped before switching. Every song still plays from internal storage.',
      );
    });
  });

  it('says why Undo was refused', async () => {
    const { tree, native } = await mount(KILLED);
    native.undoMove.mockRejectedValueOnce(refusal('E_MOVE_RUNNING'));
    await press(tree, 'Undo');
    await vi.waitFor(() => {
      expect(texts(tree)).toContain('Wait for it to stop, then undo it.');
    });
  });

  it('drops the reason once the store clears it, as Settings does', async () => {
    const { tree, native, store } = await mount(KILLED);
    native.resumeMove.mockRejectedValueOnce(refusal('E_MOVE_RUNNING'));
    await press(tree, 'Resume');
    await vi.waitFor(() => {
      expect(texts(tree)).toHaveLength(3);
    });
    act(() => {
      store.getState().dismissError();
    });
    expect(texts(tree)).toHaveLength(2);
  });

  it('holds both buttons while a request is pending', async () => {
    const { tree, store } = await mount(KILLED);
    act(() => {
      store.setState({ pending: true });
    });
    const disabled = (label: string) =>
      (button(tree, label).props as { disabled: boolean }).disabled;
    expect([disabled('Resume'), disabled('Undo')]).toEqual([true, true]);
  });
});
