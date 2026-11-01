import { describe, expect, it } from 'vitest';

import { TOOL_ID } from '../home/registry.ts';

import {
  LAST_ON_REASON,
  TOOLS_NOTE,
  toolsOnSummary,
  toolSwitchStep,
} from './toolsText.ts';

describe('toolsOnSummary', () => {
  it('counts the tools that are on', () => {
    expect(toolsOnSummary([])).toBe('4 on');
    expect(toolsOnSummary([TOOL_ID.tuner])).toBe('3 on');
  });
});

describe('toolSwitchStep', () => {
  it('switches a tool off and keeps the usual note', () => {
    expect(toolSwitchStep([], TOOL_ID.tuner, false)).toEqual({
      off: [TOOL_ID.tuner],
      note: TOOLS_NOTE,
    });
  });

  it('refuses to switch off the last tool on, and says why', () => {
    const off = [TOOL_ID.metronome, TOOL_ID.library, TOOL_ID.stems];
    expect(toolSwitchStep(off, TOOL_ID.tuner, false)).toEqual({
      off,
      note: LAST_ON_REASON,
    });
  });
});
