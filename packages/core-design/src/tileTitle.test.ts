import { describe, expect, it } from 'vitest';

import { fittedStyle, UNMEASURED_STYLE } from './oneLineFit.ts';
import { textRoles } from './roles.ts';
import { cappedTitleStyle, sharedTitleSize } from './tileTitle.ts';

const OWN = 14;
const TIGHTER = 9;
const own = fittedStyle(textRoles.tileTitle, OWN);

describe('sharedTitleSize', () => {
  it('waits for every tile', () => {
    expect(sharedTitleSize({ a: OWN }, ['a', 'b'])).toBeUndefined();
  });

  it('takes the tightest fit once all have fitted', () => {
    expect(sharedTitleSize({ a: OWN, b: TIGHTER }, ['a', 'b'])).toBe(TIGHTER);
  });
});

describe('cappedTitleStyle', () => {
  it('hides the title until the shared size is known', () => {
    expect(cappedTitleStyle(own, undefined)).toBe(UNMEASURED_STYLE);
  });

  it('shrinks to the shared size', () => {
    expect(cappedTitleStyle(own, TIGHTER)).toEqual(
      fittedStyle(textRoles.tileTitle, TIGHTER),
    );
  });

  it('keeps its own fit when the shared size is no smaller', () => {
    expect(cappedTitleStyle(own, OWN)).toBe(own);
  });
});
