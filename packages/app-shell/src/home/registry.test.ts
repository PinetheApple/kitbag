import { describe, expect, it } from 'vitest';

import {
  BUILT_TOOL_IDS,
  continueTarget,
  HOME_TOOLS,
  TOOL_ID,
} from './registry.ts';

const ALL_ON = () => true;

describe('continueTarget', () => {
  it('offers nothing before any tool has been opened', () => {
    expect(continueTarget(undefined, HOME_TOOLS, ALL_ON)).toBeUndefined();
  });

  it('resumes the last tool that can open', () => {
    expect(
      continueTarget(TOOL_ID.metronome, HOME_TOOLS, ALL_ON)?.homeTile?.route,
    ).toBe('/metronome');
  });

  it('resumes the tuner', () => {
    expect(
      continueTarget(TOOL_ID.tuner, HOME_TOOLS, ALL_ON)?.homeTile?.route,
    ).toBe('/tuner');
  });

  it('resumes the library', () => {
    expect(
      continueTarget(TOOL_ID.library, HOME_TOOLS, ALL_ON)?.homeTile?.route,
    ).toBe('/library');
  });

  it('resumes the stem songs screen', () => {
    expect(
      continueTarget(TOOL_ID.stems, HOME_TOOLS, ALL_ON)?.homeTile?.route,
    ).toBe('/stems');
  });

  it('resumes Play along', () => {
    expect(
      continueTarget(TOOL_ID.sync, HOME_TOOLS, ALL_ON)?.homeTile?.route,
    ).toBe('/sync');
  });

  it('opens Songs and Stem songs on their own screens, with no filter', () => {
    const routes = [TOOL_ID.library, TOOL_ID.stems].map(
      (id) => HOME_TOOLS.find((t) => t.id === id)?.homeTile?.route,
    );
    expect(routes).toEqual(['/library', '/stems']);
  });

  it('ignores an id no longer on the roster', () => {
    expect(continueTarget('removed-tool', HOME_TOOLS, ALL_ON)).toBeUndefined();
  });
});

describe('the Practice history shortcut', () => {
  it('opens the history and is no tool to switch off', () => {
    const shortcut = HOME_TOOLS.find((t) => t.id === TOOL_ID.practiceHistory);
    expect(shortcut?.homeTile?.route).toBe('/practice');
    expect(BUILT_TOOL_IDS).not.toContain(TOOL_ID.practiceHistory);
  });
});

describe('HOME_TOOLS', () => {
  it('has unique ids', () => {
    const ids = HOME_TOOLS.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
