// react-test-renderer is deprecated, but it alone exposes host props with no DOM.
/* eslint-disable @typescript-eslint/no-deprecated */
import type { LibrarySongRow } from '@kitbag/core-state';
import { act, createElement, type ReactNode } from 'react';
import { create, type ReactTestRenderer } from 'react-test-renderer';
import { describe, expect, it, vi } from 'vitest';

import { REANALYZE_LABEL } from '../logic/viewText.ts';

type Props = Record<string, unknown> & { readonly children?: ReactNode };

const shown = vi.hoisted((): { failure: unknown } => ({ failure: null }));

vi.mock('react-native', () => ({ View: 'View', TextInput: 'TextInput' }));

vi.mock('@kitbag/core-design', async (original) => {
  const { createElement: h } = await import('react');
  return {
    ...(await original<Record<string, unknown>>()),
    Button: (props: Props) => h('Button', { label: props.label }),
    Sheet: (props: Props) =>
      props.visible === true ? h('Sheet', null, props.children) : null,
    SheetHint: (props: Props) => h('SheetHint', null, props.children),
    TextField: () => null,
    createThemedStyles: () => () => ({}),
  };
});

vi.mock('@kitbag/core-state', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  useSongLibrary: (select: (state: unknown) => unknown) =>
    select({ codes: {}, replacePrompt: null }),
  analysisFailure: () => shown.failure,
  rowFilesOf: () => null,
  cleanName: (name: string) => name,
}));

const { LibrarySheets } = await import('./LibrarySheets.tsx');

function openActions(failure: unknown): ReactTestRenderer {
  shown.failure = failure;
  const menu = {
    kind: 'actions',
    target: { kind: 'song', id: 1, title: 'A song' } as LibrarySongRow,
    openActions: vi.fn(),
    openRename: vi.fn(),
    openDelete: vi.fn(),
    close: vi.fn(),
  } as const;
  let tree: ReactTestRenderer | undefined;
  act(() => {
    tree = create(createElement(LibrarySheets, { menu, bottomInset: 0 }));
  });
  if (tree === undefined) throw new Error('not mounted');
  return tree;
}

function sheet(tree: ReactTestRenderer) {
  const actions = tree.root.findByType('Sheet' as never);
  return {
    hint: actions.findByType('SheetHint' as never).props.children as unknown,
    buttons: actions
      .findAllByType('Button' as never)
      .map((button) => button.props.label as unknown),
  };
}

describe('the actions sheet of a song whose analysis failed', () => {
  it('names an unsupported format and offers no Re-analyse', () => {
    const actions = sheet(
      openActions({
        kind: 'unsupported',
        keptGrid: false,
        format: 'm4a',
        supported: ['WAV', 'MP3', 'FLAC', 'AIFF'],
      }),
    );
    expect(actions.hint).toBe(
      'M4A isn’t supported. Kitbag plays WAV, MP3, FLAC or AIFF.',
    );
    expect(actions.buttons).not.toContain(REANALYZE_LABEL);
  });

  it('says a supported file may be damaged and offers Re-analyse', () => {
    const actions = sheet(openActions({ kind: 'damaged', keptGrid: false }));
    expect(actions.hint).toBe(
      'This file could not be read in full and may be damaged or incomplete, so there is no beat grid to lock to.',
    );
    expect(actions.buttons).toContain(REANALYZE_LABEL);
  });

  it('offers no Re-analyse when the file is missing', () => {
    const actions = sheet(
      openActions({ kind: 'missingFile', keptGrid: false }),
    );
    expect(actions.buttons).not.toContain(REANALYZE_LABEL);
  });
});
