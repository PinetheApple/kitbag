import type { MediaSessionSnapshot } from '@kitbag/core-native';
import type { SessionChooser } from '@kitbag/core-state';

const byId = (
  sessions: readonly MediaSessionSnapshot[],
  sessionId: string | undefined,
) => sessions.find((session) => session.sessionId === sessionId);

export function orderSessions(
  sessions: readonly MediaSessionSnapshot[],
): MediaSessionSnapshot[] {
  return [
    ...sessions.filter((session) => session.playing),
    ...sessions.filter((session) => !session.playing),
  ];
}

export const chooseSession: SessionChooser = (
  sessions,
  { chosenId, pickedId },
) => {
  const picked = byId(sessions, pickedId);
  if (picked !== undefined) return picked.sessionId;
  const music = sessions.filter((session) => !session.spokenWord);
  const current = byId(music, chosenId);
  if (current?.playing) return current.sessionId;
  const playing = music.find((session) => session.playing);
  return (playing ?? current ?? music[0])?.sessionId;
};
