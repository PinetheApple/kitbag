import { describe, expect, it, vi } from 'vitest';

const gate = vi.hoisted(() => ({ saveDatabaseCopyNotice: vi.fn() }));

vi.mock('./databaseGate', () => gate);

const { runSaveCopy } = await import('./useSaveCopy.ts');

describe('runSaveCopy', () => {
  it('marks saving for the length of the save, then shows its notice', async () => {
    gate.saveDatabaseCopyNotice.mockResolvedValue('Copy saved.');
    const saving = vi.fn();
    const notice = vi.fn();

    await runSaveCopy(saving, notice);

    expect(saving.mock.calls).toEqual([[true], [false]]);
    expect(notice.mock.calls).toEqual([[null], ['Copy saved.']]);
  });

  it('never leaves saving latched when the save throws', async () => {
    gate.saveDatabaseCopyNotice.mockRejectedValue(new Error('no module'));
    const saving = vi.fn();

    await expect(runSaveCopy(saving, vi.fn())).rejects.toThrow('no module');

    expect(saving).toHaveBeenLastCalledWith(false);
  });
});
