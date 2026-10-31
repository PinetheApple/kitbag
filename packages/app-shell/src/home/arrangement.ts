import { isToolTileSize, type ToolTileSize } from '@kitbag/core-design';
import {
  hideTile,
  moveTile,
  reconcileArrangement,
  resizeTile,
  showTile,
  visibleTiles,
  type ArrangedTile,
  type Arrangement,
  type SavedArrangement,
} from '@kitbag/core-state';

import { HOME_TOOLS, type HomeToolEntry } from './registry.ts';

export type HomeArrangement = Arrangement<ToolTileSize>;
export type HomeTile = ArrangedTile<ToolTileSize>;

export const DEFAULT_ARRANGEMENT: HomeArrangement = HOME_TOOLS.flatMap(
  (tool) =>
    tool.layout === 'row'
      ? []
      : [{ toolId: tool.id, size: tool.layout, hidden: false }],
);

export function homeArrangement(
  saved: SavedArrangement | undefined,
): HomeArrangement {
  return reconcileArrangement(saved, DEFAULT_ARRANGEMENT, isToolTileSize);
}

export function toolFor(tile: HomeTile): HomeToolEntry | undefined {
  return HOME_TOOLS.find((tool) => tool.id === tile.toolId);
}

export const ARRANGE_ACTION = {
  moveUp: 'moveUp',
  moveDown: 'moveDown',
  makeWide: 'makeWide',
  makeSingle: 'makeSingle',
  hide: 'hide',
  show: 'show',
} as const;

export type ArrangeActionName =
  (typeof ARRANGE_ACTION)[keyof typeof ARRANGE_ACTION];

const ACTION_LABEL: Readonly<Record<ArrangeActionName, string>> = {
  moveUp: 'Move up',
  moveDown: 'Move down',
  makeWide: 'Make 2×1',
  makeSingle: 'Make 1×1',
  hide: 'Hide',
  show: 'Show',
};

export interface ArrangeAction {
  readonly name: ArrangeActionName;
  readonly label: string;
}

const action = (name: ArrangeActionName): ArrangeAction => ({
  name,
  label: ACTION_LABEL[name],
});

export function arrangeActions(
  arrangement: HomeArrangement,
  tile: HomeTile,
): ArrangeAction[] {
  if (tile.hidden) return [action(ARRANGE_ACTION.show)];
  const visible = visibleTiles(arrangement);
  const index = visible.findIndex((t) => t.toolId === tile.toolId);
  const names: ArrangeActionName[] = [];
  if (index > 0) names.push(ARRANGE_ACTION.moveUp);
  if (index < visible.length - 1) names.push(ARRANGE_ACTION.moveDown);
  names.push(
    tile.size === '1x1' ? ARRANGE_ACTION.makeWide : ARRANGE_ACTION.makeSingle,
    ARRANGE_ACTION.hide,
  );
  return names.map(action);
}

export function applyArrangeAction(
  arrangement: HomeArrangement,
  toolId: string,
  name: ArrangeActionName,
): HomeArrangement {
  const index = visibleTiles(arrangement).findIndex((t) => t.toolId === toolId);
  switch (name) {
    case ARRANGE_ACTION.moveUp:
      return moveTile(arrangement, toolId, index - 1);
    case ARRANGE_ACTION.moveDown:
      return moveTile(arrangement, toolId, index + 1);
    case ARRANGE_ACTION.makeWide:
      return resizeTile(arrangement, toolId, '2x1');
    case ARRANGE_ACTION.makeSingle:
      return resizeTile(arrangement, toolId, '1x1');
    case ARRANGE_ACTION.hide:
      return hideTile(arrangement, toolId);
    case ARRANGE_ACTION.show:
      return showTile(arrangement, toolId);
  }
}
