import { libraryList } from './libraryRoles.ts';
import { layout, space } from './roles.ts';

export interface ListEdges {
  readonly fabEnd: number;
  readonly dividerInset: number;
}

const PHONE_LIST_EDGES: ListEdges = {
  fabEnd: libraryList.fabEnd,
  dividerInset: 0,
};

const CAPPED_LIST_EDGES: ListEdges = {
  fabEnd: space.screenInset,
  dividerInset: space.screenInset,
};

export function listEdges(windowWidth: number): ListEdges {
  return windowWidth > layout.maxContentWidth
    ? CAPPED_LIST_EDGES
    : PHONE_LIST_EDGES;
}
