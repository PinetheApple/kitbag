export interface MediaSessionSnapshot {
  readonly sessionId: string;
  readonly packageName: string;
  readonly appLabel: string;
  readonly title: string | null;
  readonly artist: string | null;
  readonly durationMs: number | null;
  readonly playing: boolean;
  readonly positionMs: number | null;
  readonly positionUpdatedAtMs: number;
  readonly speed: number;
  readonly spokenWord: boolean;
}

export type MediaSessionStep = 'play' | 'pause' | 'next' | 'previous';

export type MediaSessionCommand =
  | { readonly type: MediaSessionStep }
  | { readonly type: 'seekTo'; readonly positionMs: number };

export type MediaSessionsListener = (
  sessions: readonly MediaSessionSnapshot[],
) => void;
