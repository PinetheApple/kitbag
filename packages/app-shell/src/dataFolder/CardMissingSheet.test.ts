// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import type { StoreApi } from 'zustand/vanilla';
import { act, createElement } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { useStore } from 'zustand';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { DataFolderStore } from '@kitbag/core-state';

import { AWAY_PATHS, CARD_OUT, fakeFolder } from './dataFolder.test-helper.ts';

const world = vi.hoisted(() => ({
  store: null as StoreApi<DataFolderStore> | null,
  importing: [] as string[],
  stemDeckRunning: false,
}));

vi.mock('react-native', () => ({ View: 'View', Text: 'Text' }));
vi.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

vi.mock('@kitbag/core-design', async (original) => {
  const { hostMock } = await import('./dataFolder.test-helper.ts');
  return {
    ...(await original<Record<string, unknown>>()),
    Sheet: hostMock('Sheet'),
    SheetHint: hostMock('Hint'),
    Button: hostMock('Button'),
    useTextScaled: () => false,
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
    useSongLibrary: <T>(select: (state: { importing: string[] }) => T) =>
      select({ importing: world.importing }),
    useStemDeck: <T>(
      select: (state: { importView: { running: boolean } }) => T,
    ) => select({ importView: { running: world.stemDeckRunning } }),
  };
});

const { CardMissingSheet } = await import('./CardMissingSheet.tsx');

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

async function mount(onDismiss = vi.fn()) {
  const folder = fakeFolder(CARD_OUT);
  world.store = folder.store;
  await folder.store.getState().start();
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(
      createElement(CardMissingSheet, { visible: true, onDismiss }),
    );
  });
  if (tree === undefined) throw new Error('not mounted');
  return { ...folder, tree, onDismiss };
}

function button(tree: ReactTestRenderer, label: string) {
  return tree.root
    .findAllByType('Button' as never)
    .find((node) => (node.props as { label: string }).label === label);
}

async function press(tree: ReactTestRenderer, label: string) {
  const found = button(tree, label);
  if (found === undefined) throw new Error(`no ${label} button`);
  await act(async () => {
    (found.props as { onPress: () => void }).onPress();
    await Promise.resolve();
  });
}

beforeEach(() => {
  world.importing = [];
  world.stemDeckRunning = false;
});

describe('SD card not found', () => {
  it('names the card and offers both ways out', async () => {
    const { tree } = await mount();
    const sheet = tree.root.findByType('Sheet' as never);
    expect((sheet.props as { title: string }).title).toBe('SD card not found');
    const hints = tree.root
      .findAllByType('Hint' as never)
      .map((hint) => (hint.props as { children: string }).children);
    expect(hints[0]).toContain('are on SanDisk SD card');
    expect(button(tree, 'Use internal storage')).toBeDefined();
    expect(button(tree, 'I’ve put it back')).toBeDefined();
  });

  it('switches to internal storage with every stored row’s paths as away', async () => {
    const { tree, native, onDismiss } = await mount();
    await press(tree, 'Use internal storage');
    await vi.waitFor(() => {
      expect(onDismiss).toHaveBeenCalled();
    });
    expect(native.switchToInternalStorage).toHaveBeenCalledExactlyOnceWith(
      AWAY_PATHS,
    );
  });

  it.each([
    ['a song import', () => (world.importing = ['Everlong.mp3'])],
    ['a StemDeck import', () => (world.stemDeckRunning = true)],
  ])('never switches while %s holds the folder', async (_name, start) => {
    start();
    const { tree, native } = await mount();
    const offer = button(tree, 'Use internal storage');
    expect((offer?.props as { disabled: boolean }).disabled).toBe(true);
    await press(tree, 'Use internal storage');
    expect(native.switchToInternalStorage).not.toHaveBeenCalled();
  });

  it('only explains when the card is put back', async () => {
    const { tree, native, onDismiss } = await mount();
    await press(tree, 'I’ve put it back');
    expect(onDismiss).toHaveBeenCalled();
    expect(native.switchToInternalStorage).not.toHaveBeenCalled();
  });

  it('keeps the sheet open and says why when the switch is refused', async () => {
    const { tree, native, onDismiss } = await mount();
    native.switchToInternalStorage.mockRejectedValueOnce(
      Object.assign(new Error('refused'), { code: 'E_MOVE_CARD_MOUNTED' }),
    );
    await press(tree, 'Use internal storage');
    await vi.waitFor(() => {
      const hints = tree.root.findAllByType('Hint' as never);
      expect(
        hints.some((hint) =>
          (hint.props as { children: string }).children.includes('is in again'),
        ),
      ).toBe(true);
    });
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
