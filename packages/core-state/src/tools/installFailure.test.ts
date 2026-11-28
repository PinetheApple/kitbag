import { KB_TOOL_REJECTION } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import { INSTALL_FAILURE, installFailure } from './installFailure.ts';

const R = KB_TOOL_REJECTION;

describe('install failure', () => {
  it.each([
    R.signature,
    R.files,
    R.manifest,
    R.zip,
    R.untrustedKey,
    R.notAsIndexed,
    R.wrongTool,
  ])('reads %s as a failed check', (code) => {
    expect(installFailure(code)).toBe(INSTALL_FAILURE.check);
  });

  it.each([R.download, R.notHttps, R.tooManyRedirects, R.tooLarge])(
    'reads %s as a stopped download',
    (code) => {
      expect(installFailure(code)).toBe(INSTALL_FAILURE.download);
    },
  );

  it('tells no connection, no space and downloads off apart', () => {
    expect(installFailure(R.offline)).toBe(INSTALL_FAILURE.offline);
    expect(installFailure(R.noSpace)).toBe(INSTALL_FAILURE.noSpace);
    expect(installFailure(R.downloadsOff)).toBe(INSTALL_FAILURE.downloadsOff);
  });

  it.each([R.internal, R.incompatible, R.rollback, R.notInIndex, null])(
    'reads %s as a generic failure',
    (code) => {
      expect(installFailure(code)).toBe(INSTALL_FAILURE.generic);
    },
  );
});
