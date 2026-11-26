import { describe, expect, it } from 'vitest';

import { TOOL_ID } from '../home/registry.ts';

import {
  LAST_ON_REASON,
  TOOLS_INTRO,
  TOOLS_NOTE,
  toolsOnSummary,
  toolSwitchStep,
} from './toolsText.ts';

describe('toolsOnSummary', () => {
  it('counts the tools that are on', () => {
    expect(toolsOnSummary([])).toBe('5 on');
    expect(toolsOnSummary([TOOL_ID.tuner])).toBe('4 on');
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
    const off = [
      TOOL_ID.metronome,
      TOOL_ID.library,
      TOOL_ID.stems,
      TOOL_ID.sync,
    ];
    expect(toolSwitchStep(off, TOOL_ID.tuner, false)).toEqual({
      off,
      note: LAST_ON_REASON,
    });
  });
});

describe('Tools text', () => {
  it('says a switch acts everywhere and Home tiles are chosen on Home', () => {
    expect(TOOLS_INTRO).toBe(
      'Turn a tool off to hide it everywhere. Nothing is deleted.',
    );
    expect(TOOLS_NOTE).toBe(
      'Choose Home tiles with Edit on Home. Other tools are under More tools.',
    );
  });
});
