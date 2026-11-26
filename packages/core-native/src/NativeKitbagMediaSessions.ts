import type { CodegenTypes, TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export type MediaSessionWire = Readonly<{
  sessionId: string;
  packageName: string;
  appLabel: string;
  title: string | null;
  artist: string | null;
  durationMs: CodegenTypes.Double | null;
  playing: boolean;
  positionMs: CodegenTypes.Double | null;
  positionUpdatedAtMs: CodegenTypes.Double;
  speed: CodegenTypes.Double;
}>;

export type MediaSessionsEvent = Readonly<{
  sessions: readonly MediaSessionWire[];
}>;

export interface Spec extends TurboModule {
  listenerEnabled(): Promise<boolean>;
  openListenerSettings(): Promise<boolean>;
  setWatching(watching: boolean): void;
  play(sessionId: string): void;
  pause(sessionId: string): void;
  skipToNext(sessionId: string): void;
  skipToPrevious(sessionId: string): void;
  seekTo(sessionId: string, positionMs: CodegenTypes.Double): void;
  readonly onSessions: CodegenTypes.EventEmitter<MediaSessionsEvent>;
}

export function getKitbagMediaSessions(): Spec {
  return TurboModuleRegistry.getEnforcing<Spec>('KitbagMediaSessions');
}
