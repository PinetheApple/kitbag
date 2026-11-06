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

vi.mock('react', () => ({
  useState: (initial: unknown) => [initial, vi.fn()],
  useCallback: <T>(callback: T) => callback,
}));
vi.mock('react-native', () => ({ Text: 'Text', View: 'View' }));
vi.mock('@kitbag/core-design', async (original) => ({
  ...(await original<Record<string, unknown>>()),
  Button: 'Button',
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

describe('PracticeSummarySheet', () => {
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
