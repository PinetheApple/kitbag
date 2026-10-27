import { describe, expect, it } from 'vitest';

import { continueTarget, HOME_TOOLS, TOOL_ID } from './registry.ts';

describe('continueTarget', () => {
  it('offers nothing before any tool has been opened', () => {
    expect(continueTarget(undefined, HOME_TOOLS)).toBeUndefined();
  });

  it('resumes the last tool that can open', () => {
    expect(continueTarget(TOOL_ID.metronome, HOME_TOOLS)?.homeTile?.route).toBe(
      '/metronome',
    );
  });

  it('resumes the tuner', () => {
    expect(continueTarget(TOOL_ID.tuner, HOME_TOOLS)?.homeTile?.route).toBe(
      '/tuner',
    );
  });

  it('resumes the library', () => {
    expect(continueTarget(TOOL_ID.library, HOME_TOOLS)?.homeTile?.route).toBe(
      '/library?chip=all',
    );
  });

  it('never resumes an upcoming tool', () => {
    expect(continueTarget(TOOL_ID.sync, HOME_TOOLS)).toBeUndefined();
  });

  it('opens the Stems tile on the stems chip', () => {
    expect(
      HOME_TOOLS.find((t) => t.id === TOOL_ID.stems)?.homeTile?.route,
    ).toBe('/library?chip=stems');
  });

  it('ignores an id no longer on the roster', () => {
    expect(continueTarget('removed-tool', HOME_TOOLS)).toBeUndefined();
  });
});

describe('HOME_TOOLS', () => {
  it('has unique ids', () => {
    const ids = HOME_TOOLS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
