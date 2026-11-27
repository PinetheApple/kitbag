import { describe, expect, it } from 'vitest';

import {
  arrangedWithOff,
  homeArrangement,
  shownArrangement,
} from './arrangement.ts';
import { continueTarget, HOME_TOOLS, TOOL_ID } from './registry.ts';
import { toolOnTest } from './toolsOn.ts';

const ids = (tiles: readonly { readonly toolId: string }[]) =>
  tiles.map((t) => t.toolId);

describe('toolOnTest', () => {
  it('has every tool on by default', () => {
    const isOn = toolOnTest([]);
    expect(HOME_TOOLS.every((tool) => isOn(tool.id))).toBe(true);
  });

  it('reports a switched-off tool as off', () => {
    expect(toolOnTest([TOOL_ID.tuner])(TOOL_ID.tuner)).toBe(false);
  });

  it('never switches off a tool the Tools screen does not list', () => {
    expect(toolOnTest([TOOL_ID.practiceHistory])(TOOL_ID.practiceHistory)).toBe(
      true,
    );
  });

  it('switches Play along off like any built tool', () => {
    expect(toolOnTest([TOOL_ID.sync])(TOOL_ID.sync)).toBe(false);
  });
});

describe('Home and Arrange with a tool off', () => {
  const isOn = toolOnTest([TOOL_ID.tuner]);

  it('leave the off tool out of the grid and the Arrange sheet', () => {
    expect(ids(shownArrangement(undefined, isOn))).toEqual([
      TOOL_ID.metronome,
      TOOL_ID.library,
      TOOL_ID.stems,
      TOOL_ID.practiceHistory,
    ]);
  });

  it('keep the off tool in the saved layout through an edit', () => {
    const shown = shownArrangement(undefined, isOn);
    const edited = [...shown].reverse();
    const saved = arrangedWithOff(undefined, edited, isOn);
    expect(ids(saved)).toEqual([
      TOOL_ID.stems,
      TOOL_ID.tuner,
      TOOL_ID.library,
      TOOL_ID.metronome,
      TOOL_ID.practiceHistory,
    ]);
  });

  it('bring the tool back where it was when it is turned on', () => {
    const saved = arrangedWithOff(
      undefined,
      shownArrangement(undefined, isOn),
      isOn,
    );
    expect(ids(shownArrangement(saved, toolOnTest([])))).toEqual(
      ids(homeArrangement(undefined)),
    );
  });
});

describe('Continue with a tool off', () => {
  it('skips the last tool when it is off', () => {
    expect(
      continueTarget(TOOL_ID.tuner, HOME_TOOLS, toolOnTest([TOOL_ID.tuner])),
    ).toBeUndefined();
  });

  it('still resumes the last tool when another is off', () => {
    expect(
      continueTarget(TOOL_ID.tuner, HOME_TOOLS, toolOnTest([TOOL_ID.stems]))
        ?.id,
    ).toBe(TOOL_ID.tuner);
  });
});
