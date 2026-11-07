import { describe, expect, it, vi } from 'vitest';

import { createMixerClaim } from './mixerClaim.ts';

describe('createMixerClaim', () => {
  it('closes the previous session when another claims the mixer', () => {
    const mixer = createMixerClaim();
    const first = vi.fn();
    const second = vi.fn();
    mixer.claim(first);
    mixer.claim(second);
    expect(first).toHaveBeenCalledOnce();
    expect(second).not.toHaveBeenCalled();
  });

  it('leaves a session alone when it claims the mixer again', () => {
    const mixer = createMixerClaim();
    const session = vi.fn();
    mixer.claim(session);
    mixer.claim(session);
    expect(session).not.toHaveBeenCalled();
  });

  it('closes nothing after its session released the claim', () => {
    const mixer = createMixerClaim();
    const first = vi.fn();
    mixer.claim(first);
    mixer.release(first);
    mixer.claim(vi.fn());
    expect(first).not.toHaveBeenCalled();
  });

  it('keeps the newer claim when a displaced session releases late', () => {
    const mixer = createMixerClaim();
    const first = vi.fn();
    const second = vi.fn();
    mixer.claim(first);
    mixer.claim(second);
    mixer.release(first);
    mixer.claim(vi.fn());
    expect(second).toHaveBeenCalledOnce();
  });
});
