import { describe, expect, it, vi } from 'vitest';

import { createLastToolStore, type LastToolPersistence } from './store.ts';

function fakePersistence(initial?: string) {
  const save = vi.fn<(toolId: string) => void>();
  const persistence: LastToolPersistence = { load: () => initial, save };
  return { persistence, save };
}

describe('last-used tool', () => {
  it('starts with nothing to continue when storage is empty', () => {
    const { persistence } = fakePersistence();
    expect(createLastToolStore(persistence).getState().toolId).toBeUndefined();
  });

  it('restores the tool storage remembered', () => {
    const { persistence } = fakePersistence('metronome');
    expect(createLastToolStore(persistence).getState().toolId).toBe(
      'metronome',
    );
  });

  it('records and saves the tool just opened', () => {
    const { persistence, save } = fakePersistence();
    const store = createLastToolStore(persistence);
    store.getState().markUsed('metronome');
    expect(store.getState().toolId).toBe('metronome');
    expect(save).toHaveBeenCalledWith('metronome');
  });

  it('skips the write when the same tool is reopened', () => {
    const { persistence, save } = fakePersistence('metronome');
    createLastToolStore(persistence).getState().markUsed('metronome');
    expect(save).not.toHaveBeenCalled();
  });
});
