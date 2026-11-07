import { describe, expect, it, vi } from 'vitest';

import { createMixerOwner } from './mixerOwner.ts';

describe('mixerOwner', () => {
  it('closes the previous session when another claims the mixer', () => {
    const owner = createMixerOwner();
    const first = vi.fn();
    const second = vi.fn();
    owner.claim(first);
    owner.claim(second);
    expect(first).toHaveBeenCalledOnce();
    expect(second).not.toHaveBeenCalled();
  });

  it('leaves a session alone when it claims the mixer again', () => {
    const owner = createMixerOwner();
    const session = vi.fn();
    owner.claim(session);
    owner.claim(session);
    expect(session).not.toHaveBeenCalled();
  });

  it('closes nothing after the owner released it', () => {
    const owner = createMixerOwner();
    const first = vi.fn();
    owner.claim(first);
    owner.release(first);
    owner.claim(vi.fn());
    expect(first).not.toHaveBeenCalled();
  });

  it('keeps the new owner when a displaced session releases late', () => {
    const owner = createMixerOwner();
    const first = vi.fn();
    const second = vi.fn();
    owner.claim(first);
    owner.claim(second);
    owner.release(first);
    owner.claim(vi.fn());
    expect(second).toHaveBeenCalledOnce();
  });
});
