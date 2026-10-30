export const APP_NIGHT_MODES = ['system', 'dark', 'light'] as const;

export type AppNightMode = (typeof APP_NIGHT_MODES)[number];

export type AppVersion = Readonly<{
  versionName: string;
  versionCode: number;
}>;
