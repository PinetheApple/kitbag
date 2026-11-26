import type { PlayAlongCardRequest } from './NativeKitbagCommands';

export const TRANSPORT_ACTIONS = [
  'tempo_down',
  'play',
  'pause',
  'tempo_up',
  'stop',
] as const;

export type TransportActionName = (typeof TRANSPORT_ACTIONS)[number];

export function transportActionNamed(
  name: string,
): TransportActionName | undefined {
  return TRANSPORT_ACTIONS.find((action) => action === name);
}

export const PLAY_ALONG_CARD_ACTION = {
  playPause: 'playPause',
  stop: 'stop',
} as const satisfies Record<string, PlayAlongCardRequest['action']>;

export const TRANSPORT_PLAYBACK = {
  playing: 'playing',
  paused: 'paused',
  stopped: 'stopped',
} as const;

export type TransportPlayback =
  (typeof TRANSPORT_PLAYBACK)[keyof typeof TRANSPORT_PLAYBACK];

export function transportPlaybackNamed(
  name: string,
): TransportPlayback | undefined {
  return Object.values(TRANSPORT_PLAYBACK).find(
    (playback) => playback === name,
  );
}
