import { describe, expect, it } from 'vitest';

import { libraryList } from './libraryRoles.ts';
import { listEdges } from './listEdges.ts';
import { space } from './roles.ts';

describe('listEdges', () => {
  it.each([411, 600])('keeps the phone edges at %i dp', (width) => {
    expect(listEdges(width)).toEqual({
      fabEnd: libraryList.fabEnd,
      dividerInset: 0,
    });
  });

  it.each([601, 800, 960])(
    'lines the FAB and dividers up with the search inset at %i dp',
    (width) => {
      expect(listEdges(width)).toEqual({
        fabEnd: space.screenInset,
        dividerInset: space.screenInset,
      });
    },
  );
});
