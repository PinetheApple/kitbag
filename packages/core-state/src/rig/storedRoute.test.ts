import { describe, expect, it } from 'vitest';

import { storedRoute } from './storedRoute.ts';

describe('stored route', () => {
  it('rebuilds a stored row as a known route', () => {
    expect(
      storedRoute({
        route: 'bt:xm4',
        offsetMs: 120,
        name: 'WH-1000XM4',
        kind: 'bluetooth',
      }),
    ).toEqual({
      id: 'bt:xm4',
      name: 'WH-1000XM4',
      kind: 'bluetooth',
      certain: true,
    });
  });

  it('reads a missing name as empty and an unknown kind as another output', () => {
    expect(
      storedRoute({ route: 'gone', offsetMs: 40, name: null, kind: 'hdmi' }),
    ).toMatchObject({ name: '', kind: 'other' });
    expect(
      storedRoute({ route: 'old', offsetMs: 0, name: null, kind: null }).kind,
    ).toBe('other');
  });
});
