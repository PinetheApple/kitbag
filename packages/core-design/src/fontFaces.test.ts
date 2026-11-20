import { describe, expect, it } from 'vitest';

import { fontFace } from './fontFaces.ts';
import * as homeArrangeRoles from './homeArrangeRoles.ts';
import * as practiceHistoryRoles from './practiceHistoryRoles.ts';
import * as roles from './roles.ts';
import { textRoles } from './roles.ts';
import * as settingsRoles from './settingsRoles.ts';
import * as snackbarRoles from './snackbarRoles.ts';
import * as stemPlayerRoles from './stemPlayerRoles.ts';
import * as swipeDeleteRoles from './swipeDeleteRoles.ts';
import { textStyle } from './textStyle.ts';
import { type TypeRole, typography } from './tokens.ts';

const roleModules = {
  homeArrangeRoles,
  practiceHistoryRoles,
  roles,
  settingsRoles,
  snackbarRoles,
  stemPlayerRoles,
  swipeDeleteRoles,
};

function isTypeRole(value: object): value is TypeRole {
  return 'family' in value && 'weight' in value;
}

function typeRolesIn(path: string, value: unknown): [string, TypeRole][] {
  if (typeof value !== 'object' || value === null) return [];
  if (isTypeRole(value)) return [[path, value]];
  return Object.entries(value).flatMap(([key, child]) =>
    typeRolesIn(`${path}.${key}`, child),
  );
}

describe('fontFace', () => {
  it('resolves every type role to a bundled face', () => {
    for (const role of [
      ...Object.values(textRoles),
      ...Object.values(typography),
    ]) {
      expect(() => fontFace(role.family, role.weight)).not.toThrow();
    }
  });

  it('resolves every exported role table to a bundled face', () => {
    const unbundled = typeRolesIn('core-design', roleModules)
      .filter(([, role]) => {
        try {
          fontFace(role.family, role.weight);
          return false;
        } catch {
          return true;
        }
      })
      .map(([path, role]) => `${path} ${role.family} ${String(role.weight)}`);
    expect(unbundled).toEqual([]);
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
