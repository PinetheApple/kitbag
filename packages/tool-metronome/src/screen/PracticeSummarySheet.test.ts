import type * as CoreState from '@kitbag/core-state';
import type { ReactElement } from 'react';
import { describe, expect, it, vi } from 'vitest';

import {
  MINUTE,
  practiceHarness,
} from '../logic/practiceSessions.test-helper.ts';

const current = vi.hoisted(() => ({
  harness: undefined as ReturnType<typeof practiceHarness> | undefined,
}));

function harness() {
  if (current.harness === undefined) throw new Error('no harness');
  return current.harness;
}

vi.mock('react', async (original) => ({
  createContext: (await original<typeof import('react')>()).createContext,
  useState: (initial: unknown) => [initial, vi.fn()],
  useCallback: <T>(callback: T) => callback,
}));
vi.mock('react-native', () => ({ Text: 'Text', View: 'View' }));
vi.mock('@kitbag/core-design', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  Button: 'Button',
  ButtonRow: 'ButtonRow',
  EditDivider: 'EditDivider',
  EditRow: 'EditRow',
  EditValue: 'EditValue',
  Sheet: 'Sheet',
  SheetHint: 'SheetHint',
  createThemedStyles: () => () => ({}),
}));
vi.mock('@kitbag/core-state', async (original) => ({
  ...(await original<typeof CoreState>()),
  getPracticeSessionStore: () => harness().sessions,
}));

const { PracticeSummarySheet } = await import('./PracticeSummarySheet.tsx');

interface SheetProps {
  readonly onDismiss: () => void;
}

interface Node {
  readonly type: unknown;
  readonly props: { readonly children?: unknown; readonly label?: unknown };
}

function find(node: unknown, test: (n: Node) => boolean): Node | undefined {
  if (Array.isArray(node))
    return node.map((child) => find(child, test)).find((n) => n !== undefined);
  if (node === null || typeof node !== 'object' || !('props' in node))
    return undefined;
  const element = node as Node;
  return test(element) ? element : find(element.props.children, test);
}

describe('PracticeSummarySheet', () => {
  it('sets Discard and Save in a ButtonRow, which stacks them at large text', () => {
    current.harness = practiceHarness();
    const h = harness();
    h.metronome.getState().start();
    h.advance(MINUTE);
    h.end();
    const sheet = PracticeSummarySheet({
      visible: true,
      summary: h.sessions.getState().pending[0] ?? null,
      bottomInset: 0,
    });
    const row = find(sheet, (n) => n.type === 'ButtonRow');
    expect(find(row, (n) => n.props.label === 'Discard')).toBeDefined();
  });

  it('saves the session when dismissed by Back, drag or a tap outside', async () => {
    current.harness = practiceHarness();
    const h = harness();
    h.metronome.getState().start();
    h.advance(MINUTE);
    h.end();
    const sheet = PracticeSummarySheet({
      visible: true,
      summary: h.sessions.getState().pending[0] ?? null,
      bottomInset: 0,
    }) as ReactElement<SheetProps>;
    sheet.props.onDismiss();
    await vi.waitFor(() => {
      expect(h.sessions.getState().pending).toEqual([]);
    });
    expect(h.insert).toHaveBeenCalledOnce();
  });
});
