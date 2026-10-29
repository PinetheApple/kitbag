import { cleanName } from '../names.ts';
import type { ActionContext, StemPlayerActions } from './store.ts';

export function renameActions({
  set,
  get,
  runtimeOf,
  session,
}: ActionContext): Pick<StemPlayerActions, 'renameStem'> {
  const nameRow = (id: number, name: string) => {
    set((s) => ({
      stems: s.stems.map((row) => (row.id === id ? { ...row, name } : row)),
    }));
  };
  return {
    renameStem: async (index, raw) => {
      const row = get().stems[index];
      const name = cleanName(raw);
      if (row === undefined || name === null || name === row.name) return;
      const opened = session();
      nameRow(row.id, name);
      try {
        await runtimeOf().records.renameStem(row.id, name);
      } catch (error: unknown) {
        console.warn('[kitbag] stem rename not stored', error);
        if (opened === session()) nameRow(row.id, row.name);
      }
    },
  };
}
