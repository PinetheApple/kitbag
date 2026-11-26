import { FACT_SEPARATOR } from '@kitbag/core-design';
import type { MediaSessionSnapshot } from '@kitbag/core-native';

export type SourceIcon = 'song' | 'spokenAudio';

export const MIN_SESSIONS_TO_CHOOSE = 2;

export interface SourceRow {
  readonly sessionId: string;
  readonly appLabel: string;
  readonly detail: string;
  readonly icon: SourceIcon;
  readonly followed: boolean;
  readonly live: boolean;
}

const RANK = { playingMusic: 0, pausedMusic: 1, spokenWord: 2 } as const;

function rank(session: MediaSessionSnapshot): number {
  if (session.spokenWord) return RANK.spokenWord;
  return session.playing ? RANK.playingMusic : RANK.pausedMusic;
}

function detailOf(session: MediaSessionSnapshot): string {
  if (session.spokenWord) {
    const state = session.playing ? 'playing' : 'paused';
    return ['Podcast', state, 'not picked for you'].join(FACT_SEPARATOR);
  }
  const state = session.playing ? 'Playing' : 'Paused';
  return session.title === null
    ? state
    : [state, session.title].join(FACT_SEPARATOR);
}

export function sourceRows(
  sessions: readonly MediaSessionSnapshot[],
  followedId: string | undefined,
): readonly SourceRow[] {
  return sessions
    .map((session, index) => ({ session, index }))
    .sort((a, b) => rank(a.session) - rank(b.session) || a.index - b.index)
    .map(({ session }) => ({
      sessionId: session.sessionId,
      appLabel: session.appLabel,
      detail: detailOf(session),
      icon: session.spokenWord ? 'spokenAudio' : 'song',
      followed: session.sessionId === followedId,
      live: session.playing && !session.spokenWord,
    }));
}
