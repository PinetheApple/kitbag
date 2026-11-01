import { describe, expect, it, vi } from 'vitest';

import { createToolsStore, type ToolsPersistence } from './store.ts';

function fakePersistence(initial: readonly string[] = []) {
  const save = vi.fn<ToolsPersistence['save']>();
  const persistence: ToolsPersistence = { load: () => initial, save };
  return { persistence, save };
}

describe('tools store', () => {
  it('has every tool on before anything is switched off', () => {
    expect(createToolsStore().getState().off).toEqual([]);
  });

  it('restores the tools storage remembered as off', () => {
    const { persistence } = fakePersistence(['tuner']);
    expect(createToolsStore(persistence).getState().off).toEqual(['tuner']);
  });

  it('records and saves the tools now off', () => {
    const { persistence, save } = fakePersistence();
    const store = createToolsStore(persistence);
    store.getState().setOff(['stems']);
    expect(store.getState().off).toEqual(['stems']);
    expect(save).toHaveBeenCalledWith(['stems']);
  });

  it('survives a restart through the same storage', () => {
    let stored: readonly string[] = [];
    const persistence: ToolsPersistence = {
      load: () => stored,
      save: (off) => {
        stored = off;
      },
    };
    createToolsStore(persistence).getState().setOff(['library']);
    expect(createToolsStore(persistence).getState().off).toEqual(['library']);
  });
});
