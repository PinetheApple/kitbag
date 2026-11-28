import { KB_TOOL_REJECTION } from '@kitbag/core-native';

export const INSTALL_FAILURE = {
  check: 'check',
  download: 'download',
  offline: 'offline',
  noSpace: 'noSpace',
  downloadsOff: 'downloadsOff',
  generic: 'generic',
} as const;

export type InstallFailure =
  (typeof INSTALL_FAILURE)[keyof typeof INSTALL_FAILURE];

const FAILURES: Readonly<Partial<Record<KB_TOOL_REJECTION, InstallFailure>>> = {
  [KB_TOOL_REJECTION.signature]: INSTALL_FAILURE.check,
  [KB_TOOL_REJECTION.files]: INSTALL_FAILURE.check,
  [KB_TOOL_REJECTION.manifest]: INSTALL_FAILURE.check,
  [KB_TOOL_REJECTION.zip]: INSTALL_FAILURE.check,
  [KB_TOOL_REJECTION.untrustedKey]: INSTALL_FAILURE.check,
  [KB_TOOL_REJECTION.notAsIndexed]: INSTALL_FAILURE.check,
  [KB_TOOL_REJECTION.wrongTool]: INSTALL_FAILURE.check,
  [KB_TOOL_REJECTION.download]: INSTALL_FAILURE.download,
  [KB_TOOL_REJECTION.notHttps]: INSTALL_FAILURE.download,
  [KB_TOOL_REJECTION.tooManyRedirects]: INSTALL_FAILURE.download,
  [KB_TOOL_REJECTION.tooLarge]: INSTALL_FAILURE.download,
  [KB_TOOL_REJECTION.offline]: INSTALL_FAILURE.offline,
  [KB_TOOL_REJECTION.noSpace]: INSTALL_FAILURE.noSpace,
  [KB_TOOL_REJECTION.downloadsOff]: INSTALL_FAILURE.downloadsOff,
};

export function installFailure(code: KB_TOOL_REJECTION | null): InstallFailure {
  return (
    (code === null ? undefined : FAILURES[code]) ?? INSTALL_FAILURE.generic
  );
}
