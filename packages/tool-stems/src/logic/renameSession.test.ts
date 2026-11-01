import { describe, expect, it, vi } from 'vitest';

import { createRenameSession } from './renameSession.ts';

const OLD_NAME = 'Bass';
const TYPED = 'Bass DI';

function typedSession() {
  const ends = { save: vi.fn<(name: string) => void>(), cancel: vi.fn() };
  const session = createRenameSession(OLD_NAME, () => ends);
  session.type(TYPED);
  return { ends, session };
}

describe('createRenameSession', () => {
  it('cancels on Back, keeps the old name and consumes the press', () => {
    const { ends, session } = typedSession();
    expect(session.back()).toBe(true);
    expect(ends.cancel).toHaveBeenCalledOnce();
    expect(ends.save).not.toHaveBeenCalled();
  });

  it('cancels when Back closes the keyboard', () => {
    const { ends, session } = typedSession();
    session.cancel();
    expect(ends.cancel).toHaveBeenCalledOnce();
    expect(ends.save).not.toHaveBeenCalled();
  });

  it('saves the typed name on blur', () => {
    const { ends, session } = typedSession();
    session.save();
    expect(ends.save).toHaveBeenCalledExactlyOnceWith(TYPED);
    expect(ends.cancel).not.toHaveBeenCalled();
  });

  it('saves the old name when nothing was typed', () => {
    const ends = { save: vi.fn<(name: string) => void>(), cancel: vi.fn() };
    createRenameSession(OLD_NAME, () => ends).save();
    expect(ends.save).toHaveBeenCalledExactlyOnceWith(OLD_NAME);
  });

  it('ignores the unmount save after Back cancelled', () => {
    const { ends, session } = typedSession();
    session.back();
    session.save();
    expect(ends.save).not.toHaveBeenCalled();
  });

  it('leaves Back to the screen once the edit has ended', () => {
    const { ends, session } = typedSession();
    session.save();
    expect(session.back()).toBe(false);
    expect(ends.cancel).not.toHaveBeenCalled();
  });
});
