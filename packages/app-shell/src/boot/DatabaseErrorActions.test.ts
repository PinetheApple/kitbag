import { DatabaseOpenError, type DatabaseOpenErrorKind } from '@kitbag/core-db';
import { createElement, type ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';

import {
  DATABASE_ERROR_TEXT,
  databaseErrorFrame,
  offersRetry,
} from './databaseErrorCopy.ts';

const labels = vi.hoisted(() => [] as string[]);
const disabled = vi.hoisted(() => new Map<string, boolean>());

vi.mock('react-native', () => ({
  StyleSheet: { create: <T>(styles: T) => styles },
  View: ({ children }: { readonly children?: ReactNode }) => children,
}));
vi.mock('@kitbag/core-design', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  Button: ({
    label,
    disabled: off,
  }: {
    readonly label: string;
    readonly disabled: boolean;
  }) => {
    labels.push(label);
    disabled.set(label, off);
    return null;
  },
}));

const { DatabaseErrorActions } = await import('./DatabaseErrorActions.tsx');

function renderActions(state: { retrying: boolean; saving: boolean }) {
  disabled.clear();
  renderToStaticMarkup(
    createElement(DatabaseErrorActions, {
      stacked: false,
      canRetry: true,
      ...state,
      onRetry: () => undefined,
      onSaveCopy: () => undefined,
    }),
  );
  return Object.fromEntries(disabled);
}

function actionsFor(kind: DatabaseOpenErrorKind): readonly string[] {
  labels.length = 0;
  const frame = databaseErrorFrame(new DatabaseOpenError(kind));
  renderToStaticMarkup(
    createElement(DatabaseErrorActions, {
      stacked: false,
      canRetry: offersRetry(frame),
      retrying: false,
      saving: false,
      onRetry: () => undefined,
      onSaveCopy: () => undefined,
    }),
  );
  return [...labels];
}

describe('DatabaseErrorActions', () => {
  it('offers only Save a copy for data from a newer Kitbag', () => {
    expect(actionsFor('newer-version')).toEqual([DATABASE_ERROR_TEXT.saveCopy]);
  });

  it.each<DatabaseOpenErrorKind>(['migration', 'storage', 'open'])(
    'offers Try again and Save a copy for a %s failure',
    (kind) => {
      expect(actionsFor(kind)).toEqual([
        DATABASE_ERROR_TEXT.retry,
        DATABASE_ERROR_TEXT.saveCopy,
      ]);
    },
  );

  it('disables Try again while a copy is being saved, so nothing migrates the file mid-copy', () => {
    expect(renderActions({ retrying: false, saving: true })).toEqual({
      [DATABASE_ERROR_TEXT.retry]: true,
      [DATABASE_ERROR_TEXT.saveCopy]: true,
    });
  });

  it('disables Save a copy while the retry is in flight', () => {
    expect(renderActions({ retrying: true, saving: false })).toEqual({
      [DATABASE_ERROR_TEXT.retry]: true,
      [DATABASE_ERROR_TEXT.saveCopy]: true,
    });
  });

  it('enables both when nothing is in flight', () => {
    expect(renderActions({ retrying: false, saving: false })).toEqual({
      [DATABASE_ERROR_TEXT.retry]: false,
      [DATABASE_ERROR_TEXT.saveCopy]: false,
    });
  });
});
