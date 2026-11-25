import type { SavedArrangement } from '@kitbag/core-state';
import { describe, expect, it } from 'vitest';

import {
  ARRANGE_ACTION,
  applyArrangeAction,
  arrangeActions,
  DEFAULT_ARRANGEMENT,
  homeArrangement,
  moreTools,
  shownArrangement,
  type HomeArrangement,
} from './arrangement.ts';
import { BUILT_TOOL_IDS, TOOL_ID } from './registry.ts';
import { toolOnTest } from './toolsOn.ts';

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
      TOOL_ID.practiceHistory,
    ]);
    expect(visibleIds(homeArrangement(undefined))).not.toContain(
      TOOL_ID.practiceHistory,
    );
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
      { toolId: TOOL_ID.practiceHistory, size: '1x1', hidden: true },
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
      TOOL_ID.practiceHistory,
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

describe('Home tiles and More tools', () => {
  const listed = (saved: SavedArrangement | undefined, off: string[]) => {
    const shown = shownArrangement(saved, toolOnTest(off));
    return {
      tiles: visibleIds(shown),
      more: moreTools(shown).map((tool) => tool.id),
    };
  };

  const hiding = (toolIds: readonly string[]) =>
    toolIds.reduce(
      (arrangement, toolId) =>
        applyArrangeAction(arrangement, toolId, ARRANGE_ACTION.hide),
      DEFAULT_ARRANGEMENT,
    );

  it('on a fresh install lists Practice history under More tools only', () => {
    expect(listed(undefined, [])).toEqual({
      tiles: [TOOL_ID.metronome, TOOL_ID.tuner, TOOL_ID.library, TOOL_ID.stems],
      more: [TOOL_ID.practiceHistory],
    });
  });

  it('lists a hidden tool under More tools and a tool that is off nowhere', () => {
    expect(listed(hiding([TOOL_ID.stems]), [TOOL_ID.tuner])).toEqual({
      tiles: [TOOL_ID.metronome, TOOL_ID.library],
      more: [TOOL_ID.practiceHistory, TOOL_ID.stems],
    });
    expect(listed(hiding([TOOL_ID.tuner]), [TOOL_ID.tuner])).toEqual({
      tiles: [TOOL_ID.metronome, TOOL_ID.library, TOOL_ID.stems],
      more: [TOOL_ID.practiceHistory],
    });
  });

  it('lists every tool that is on exactly once, whatever is hidden or off', () => {
    const tileIds = ids(DEFAULT_ARRANGEMENT);
    const subsets = <T>(items: readonly T[]): T[][] =>
      items.reduce<T[][]>(
        (all, item) => [...all, ...all.map((subset) => [...subset, item])],
        [[]],
      );
    for (const hidden of subsets(tileIds)) {
      for (const off of [[], ...BUILT_TOOL_IDS.map((id) => [id])]) {
        const { tiles, more } = listed(hiding(hidden), off);
        const on = tileIds.filter((id) => !off.includes(id));
        expect([...tiles, ...more].sort()).toEqual([...on].sort());
      }
    }
  });
});
