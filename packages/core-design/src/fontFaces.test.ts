import { describe, expect, it } from 'vitest';

import { fontFace } from './fontFaces.ts';
import { textRoles } from './roles.ts';
import { textStyle } from './textStyle.ts';
import { typography } from './tokens.ts';

describe('fontFace', () => {
  it('resolves every type role to a bundled face', () => {
    for (const role of [
      ...Object.values(textRoles),
      ...Object.values(typography),
    ]) {
      expect(() => fontFace(role.family, role.weight)).not.toThrow();
    }
  });

  it('picks the face for the weight instead of leaving weight to the platform', () => {
    expect(textStyle(typography.display)).toMatchObject({
      fontFamily: 'SpaceGrotesk_700Bold',
    });
    expect(textStyle(typography.body)).toMatchObject({
      fontFamily: 'Inter_400Regular',
    });
    expect(textStyle(typography.display).fontWeight).toBeUndefined();
  });

  it('refuses a weight that is not bundled', () => {
    expect(() => fontFace('Inter', 900)).toThrow();
  });
});
