const SOURCE_HOST = 'github.com';

export const SOURCE_URL = `https://${SOURCE_HOST}/PinetheApple/kitbag`;
export const LICENCE_URL = `${SOURCE_URL}/blob/main/LICENSE`;
export const LICENCE_NAME = 'GPLv3';
export const SOURCE_LABEL = `${SOURCE_HOST}/…`;

// A9 reads versionName and versionCode from the APK; app.json holds only a floor.
export function installedVersion(): string | undefined {
  return undefined;
}
