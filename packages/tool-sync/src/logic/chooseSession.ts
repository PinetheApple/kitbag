import type { MediaSessionSnapshot } from '@kitbag/core-native';
import type { SessionChooser } from '@kitbag/core-state';

const byId = (
  sessions: readonly MediaSessionSnapshot[],
  sessionId: string | undefined,
) => sessions.find((session) => session.sessionId === sessionId);

export const chooseSession: SessionChooser = (
  sessions,
  { chosenId, pickedId },
) => {
  const held = byId(sessions, pickedId) ?? byId(sessions, chosenId);
  if (held !== undefined) return held.sessionId;
  const music = sessions.filter((session) => !session.spokenWord);
  return (music.find((session) => session.playing) ?? music[0])?.sessionId;
};
