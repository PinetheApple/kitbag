import { describe, expect, it } from 'vitest';

import { contentColumn, listEdges } from './contentColumn.ts';
import { libraryList } from './libraryRoles.ts';
import { layout, space } from './roles.ts';

const PHONE_WIDTHS = [320, 360, 393, 411];
const WIDE_WIDTHS = [601, 800, 960];

describe('contentColumn', () => {
  it.each(PHONE_WIDTHS)('fills a %i dp phone with no side band', (width) => {
    expect(contentColumn(width)).toEqual({
      width,
      sideBand: 0,
      capped: false,
    });
  });

  it('fills a window exactly as wide as the cap', () => {
    expect(contentColumn(layout.maxContentWidth)).toEqual({
      width: layout.maxContentWidth,
      sideBand: 0,
      capped: false,
    });
  });

  it.each(WIDE_WIDTHS)('caps and centres a %i dp window', (width) => {
    const column = contentColumn(width);
    expect(column.width).toBe(layout.maxContentWidth);
    expect(column.sideBand * 2 + column.width).toBe(width);
    expect(column.capped).toBe(true);
  });
});

describe('listEdges', () => {
  it.each([...PHONE_WIDTHS, layout.maxContentWidth])(
    'keeps the phone FAB and full-bleed rows at %i dp',
    (width) => {
      expect(listEdges(width)).toEqual({
        fabEnd: libraryList.fabEnd,
        rowMargin: 0,
        rowStart: space.screenInset,
      });
    },
  );

  it.each(WIDE_WIDTHS)(
    'lines the FAB and row dividers up with the search inset at %i dp',
    (width) => {
      expect(listEdges(width)).toEqual({
        fabEnd: space.screenInset,
        rowMargin: space.screenInset,
        rowStart: 0,
      });
    },
  );

  it('starts row text where the phone row starts it, capped or not', () => {
    const phone = listEdges(PHONE_WIDTHS[0] ?? 0);
    const wide = listEdges(WIDE_WIDTHS[0] ?? 0);
    expect(wide.rowMargin + wide.rowStart).toBe(
      phone.rowMargin + phone.rowStart,
    );
  });
});
