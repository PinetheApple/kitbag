export const PLAY_ALONG_VIEW = {
  checking: 'checking',
  explainer: 'explainer',
  stillOff: 'stillOff',
  denied: 'denied',
  nothing: 'nothing',
  song: 'song',
} as const;

export type PlayAlongView =
  (typeof PLAY_ALONG_VIEW)[keyof typeof PLAY_ALONG_VIEW];

export interface PlayAlongViewInputs {
  readonly access: boolean | undefined;
  readonly askedForAccess: boolean;
  readonly declined: boolean;
  readonly hasSong: boolean;
}

export function playAlongView({
  access,
  askedForAccess,
  declined,
  hasSong,
}: PlayAlongViewInputs): PlayAlongView {
  if (access === undefined) return PLAY_ALONG_VIEW.checking;
  if (access) return hasSong ? PLAY_ALONG_VIEW.song : PLAY_ALONG_VIEW.nothing;
  if (declined) return PLAY_ALONG_VIEW.denied;
  return askedForAccess ? PLAY_ALONG_VIEW.stillOff : PLAY_ALONG_VIEW.explainer;
}
