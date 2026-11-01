import { describe, expect, it } from 'vitest';

import { switchTool, TOOL_SWITCH, toolsOn } from './switches.ts';

const ROSTER = ['metronome', 'tuner', 'library', 'stems'];

describe('toolsOn', () => {
  it('has every tool on when none is off', () => {
    expect(toolsOn(ROSTER, [])).toEqual(ROSTER);
  });

  it('leaves out the tools that are off, keeping roster order', () => {
    expect(toolsOn(ROSTER, ['tuner', 'stems'])).toEqual([
      'metronome',
      'library',
    ]);
  });

  it('ignores off ids that are not on the roster', () => {
    expect(toolsOn(ROSTER, ['removed-tool'])).toEqual(ROSTER);
  });

  it('turns everything back on rather than leave Home with nothing', () => {
    expect(toolsOn(ROSTER, ROSTER)).toEqual(ROSTER);
  });
});

describe('switchTool', () => {
  it('turns a tool off', () => {
    expect(switchTool([], ROSTER, 'tuner', false)).toEqual({
      outcome: TOOL_SWITCH.switched,
      off: ['tuner'],
    });
  });

  it('turns a tool back on', () => {
    expect(switchTool(['tuner', 'stems'], ROSTER, 'tuner', true)).toEqual({
      outcome: TOOL_SWITCH.switched,
      off: ['stems'],
    });
  });

  it('refuses to turn off the last tool that is on', () => {
    const off = ['metronome', 'library', 'stems'];
    expect(switchTool(off, ROSTER, 'tuner', false)).toEqual({
      outcome: TOOL_SWITCH.lastOn,
      off,
    });
  });

  it('changes nothing when the tool is already in that state', () => {
    const off = ['tuner'];
    expect(switchTool(off, ROSTER, 'tuner', false).off).toBe(off);
    expect(switchTool(off, ROSTER, 'tuner', false).outcome).toBe(
      TOOL_SWITCH.unchanged,
    );
  });

  it('ignores a tool that is not on the roster', () => {
    expect(switchTool([], ROSTER, 'removed-tool', false).outcome).toBe(
      TOOL_SWITCH.unchanged,
    );
  });

  it('treats a stored all-off set as all on, the way it is shown', () => {
    expect(switchTool(ROSTER, ROSTER, 'tuner', false)).toEqual({
      outcome: TOOL_SWITCH.switched,
      off: ['tuner'],
    });
    expect(switchTool(ROSTER, ROSTER, 'tuner', true).outcome).toBe(
      TOOL_SWITCH.unchanged,
    );
  });
});
