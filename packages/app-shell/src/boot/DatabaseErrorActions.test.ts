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

vi.mock('react-native', () => ({
  StyleSheet: { create: <T>(styles: T) => styles },
  View: ({ children }: { readonly children?: ReactNode }) => children,
}));
vi.mock('@kitbag/core-design', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  Button: ({ label }: { readonly label: string }) => {
    labels.push(label);
    return null;
  },
}));

const { DatabaseErrorActions } = await import('./DatabaseErrorActions.tsx');

function actionsFor(kind: DatabaseOpenErrorKind): readonly string[] {
  labels.length = 0;
  const frame = databaseErrorFrame(new DatabaseOpenError(kind));
  renderToStaticMarkup(
    createElement(DatabaseErrorActions, {
      stacked: false,
      canRetry: offersRetry(frame),
      retrying: false,
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
});
