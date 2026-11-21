import { libraryList } from './libraryRoles.ts';
import { layout, space } from './roles.ts';

export interface ContentColumn {
  readonly width: number;
  readonly sideBand: number;
  readonly capped: boolean;
}

export interface ListEdges {
  readonly fabEnd: number;
  readonly rowMargin: number;
  readonly rowStart: number;
}

export const contentColumnStyle = {
  width: '100%',
  maxWidth: layout.maxContentWidth,
  alignSelf: 'center',
} as const;

const PHONE_LIST_EDGES: ListEdges = {
  fabEnd: libraryList.fabEnd,
  rowMargin: 0,
  rowStart: space.screenInset,
};

// The column's edge is invisible on the shared background, so full-bleed rows
// and the FAB pull in to the header and search inset once the cap applies.
const CAPPED_LIST_EDGES: ListEdges = {
  fabEnd: space.screenInset,
  rowMargin: space.screenInset,
  rowStart: 0,
};

export function contentColumn(windowWidth: number): ContentColumn {
  const width = Math.min(windowWidth, layout.maxContentWidth);
  return {
    width,
    sideBand: (windowWidth - width) / 2,
    capped: windowWidth > layout.maxContentWidth,
  };
}

export function listEdges(windowWidth: number): ListEdges {
  return contentColumn(windowWidth).capped
    ? CAPPED_LIST_EDGES
    : PHONE_LIST_EDGES;
}
