import { describe, expect, it, vi } from 'vitest';

import { createToolSwitchesStore, type ToolsPersistence } from './store.ts';

function fakePersistence(initial: readonly string[] = []) {
  const save = vi.fn<ToolsPersistence['save']>();
  const persistence: ToolsPersistence = { load: () => initial, save };
  return { persistence, save };
}

describe('tools store', () => {
  it('has every tool on before anything is switched off', () => {
    expect(createToolSwitchesStore().getState().off).toEqual([]);
  });

  it('restores the tools storage remembered as off', () => {
    const { persistence } = fakePersistence(['tuner']);
    expect(createToolSwitchesStore(persistence).getState().off).toEqual([
      'tuner',
    ]);
  });

  it('records and saves the tools now off', () => {
    const { persistence, save } = fakePersistence();
    const store = createToolSwitchesStore(persistence);
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
    createToolSwitchesStore(persistence).getState().setOff(['library']);
    expect(createToolSwitchesStore(persistence).getState().off).toEqual([
      'library',
    ]);
  });
});
