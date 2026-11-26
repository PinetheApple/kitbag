import { clampUnit, FACT_SEPARATOR } from '@kitbag/core-design';
import {
  extrapolatedPositionMs,
  type PlayAlongTrack,
} from '@kitbag/core-state';
import type { MediaSessionSnapshot } from '@kitbag/core-native';

import { UNKNOWN_TITLE } from './nowPlaying.ts';

export const PLAY_ALONG_NAME = 'Play along';

export interface ProgressPlan {
  readonly from: number;
  readonly msToEnd: number | undefined;
}

const NO_PROGRESS: ProgressPlan = { from: 0, msToEnd: undefined };

export function progressPlan(
  session: MediaSessionSnapshot | undefined,
  nowMs: number,
): ProgressPlan {
  const durationMs = session?.durationMs ?? null;
  if (session === undefined || durationMs === null || durationMs <= 0)
    return NO_PROGRESS;
  const positionMs = extrapolatedPositionMs(session, nowMs);
  if (positionMs === null) return NO_PROGRESS;
  const from = clampUnit(positionMs / durationMs);
  const runs = session.playing && session.speed > 0 && from < 1;
  return {
    from,
    msToEnd: runs ? (durationMs - positionMs) / session.speed : undefined,
  };
}

export function lockedTitle(track: PlayAlongTrack): string {
  return track.title ?? UNKNOWN_TITLE;
}

export function lockedToLine(appLabel: string | undefined): string {
  const lock = appLabel === undefined ? 'locked' : `locked to ${appLabel}`;
  return PLAY_ALONG_NAME + FACT_SEPARATOR + lock;
}

export function lockedSubtext(appLabel: string): string {
  return `Locked${FACT_SEPARATOR}${appLabel}`;
}
