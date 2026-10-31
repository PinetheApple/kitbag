import type { AppVersion } from '@kitbag/core-native';

export function formatAppVersion({
  versionName,
  versionCode,
}: AppVersion): string {
  return `${versionName} · build ${String(versionCode)}`;
}
