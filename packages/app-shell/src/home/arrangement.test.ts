import type { SavedArrangement } from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import {
  ARRANGE_ACTION,
  applyArrangeAction,
  arrangeActions,
  DEFAULT_ARRANGEMENT,
  homeArrangement,
  type HomeArrangement,
} from './arrangement.ts';
import { TOOL_ID } from './registry.ts';

const ids = (arrangement: HomeArrangement) => arrangement.map((t) => t.toolId);

const visibleIds = (arrangement: HomeArrangement) =>
  arrangement.filter((t) => !t.hidden).map((t) => t.toolId);

describe('homeArrangement', () => {
  it('with nothing saved, lays out the grid tools in registry order', () => {
    expect(ids(homeArrangement(undefined))).toEqual([
      TOOL_ID.metronome,
      TOOL_ID.tuner,
      TOOL_ID.library,
      TOOL_ID.stems,
    ]);
  });

  it('never offers a row tool as a tile', () => {
    expect(ids(DEFAULT_ARRANGEMENT)).not.toContain(TOOL_ID.sync);
  });

  it('restores a saved layout and appends a tool it did not know', () => {
    const saved: SavedArrangement = [
      { toolId: TOOL_ID.stems, size: '2x1', hidden: false },
      { toolId: TOOL_ID.metronome, size: '1x1', hidden: false },
      { toolId: TOOL_ID.tuner, size: '1x1', hidden: true },
    ];
    expect(homeArrangement(saved)).toEqual([
      { toolId: TOOL_ID.stems, size: '2x1', hidden: false },
      { toolId: TOOL_ID.metronome, size: '1x1', hidden: false },
      { toolId: TOOL_ID.library, size: '1x1', hidden: false },
      { toolId: TOOL_ID.tuner, size: '1x1', hidden: true },
    ]);
  });
});

describe('arrange accessibility actions', () => {
  const tile = (toolId: string) => {
    const found = DEFAULT_ARRANGEMENT.find((t) => t.toolId === toolId);
    if (found === undefined) throw new Error(toolId);
    return found;
  };

  it('offers move down, resize and hide on the first tile, but not move up', () => {
    expect(
      arrangeActions(DEFAULT_ARRANGEMENT, tile(TOOL_ID.metronome)).map(
        (a) => a.label,
      ),
    ).toEqual(['Move down', 'Make 2×1', 'Hide']);
  });

  it('offers move up but not move down on the last tile', () => {
    expect(
      arrangeActions(DEFAULT_ARRANGEMENT, tile(TOOL_ID.stems)).map(
        (a) => a.name,
      ),
    ).toEqual([
      ARRANGE_ACTION.moveUp,
      ARRANGE_ACTION.makeWide,
      ARRANGE_ACTION.hide,
    ]);
  });

  it('offers only show on a hidden tool', () => {
    const hidden = applyArrangeAction(
      DEFAULT_ARRANGEMENT,
      TOOL_ID.tuner,
      ARRANGE_ACTION.hide,
    );
    const tuner = hidden.find((t) => t.toolId === TOOL_ID.tuner);
    if (tuner === undefined) throw new Error('tuner');
    expect(arrangeActions(hidden, tuner).map((a) => a.label)).toEqual(['Show']);
  });

  it('moves up and down one place', () => {
    const down = applyArrangeAction(
      DEFAULT_ARRANGEMENT,
      TOOL_ID.metronome,
      ARRANGE_ACTION.moveDown,
    );
    expect(ids(down)).toEqual([
      TOOL_ID.tuner,
      TOOL_ID.metronome,
      TOOL_ID.library,
      TOOL_ID.stems,
    ]);
    expect(
      applyArrangeAction(down, TOOL_ID.metronome, ARRANGE_ACTION.moveUp),
    ).toEqual(DEFAULT_ARRANGEMENT);
  });

  it('resizes to 2×1 and back', () => {
    const wide = applyArrangeAction(
      DEFAULT_ARRANGEMENT,
      TOOL_ID.tuner,
      ARRANGE_ACTION.makeWide,
    );
    expect(wide.find((t) => t.toolId === TOOL_ID.tuner)?.size).toBe('2x1');
    expect(
      applyArrangeAction(wide, TOOL_ID.tuner, ARRANGE_ACTION.makeSingle),
    ).toEqual(DEFAULT_ARRANGEMENT);
  });

  it('hides a tool and shows it again at the end', () => {
    const hidden = applyArrangeAction(
      DEFAULT_ARRANGEMENT,
      TOOL_ID.metronome,
      ARRANGE_ACTION.hide,
    );
    expect(visibleIds(hidden)).not.toContain(TOOL_ID.metronome);
    const shown = applyArrangeAction(
      hidden,
      TOOL_ID.metronome,
      ARRANGE_ACTION.show,
    );
    expect(visibleIds(shown)).toEqual([
      TOOL_ID.tuner,
      TOOL_ID.library,
      TOOL_ID.stems,
      TOOL_ID.metronome,
    ]);
  });
});
