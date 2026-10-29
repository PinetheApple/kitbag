import { KB_RESULT } from '@kitbag/core-native';

const NO_SESSION = -1;

export interface SessionCall {
  readonly result: number;
  readonly live: boolean;
}

export interface SessionGate {
  readonly busy: () => boolean;
  readonly call: (request: () => Promise<number>) => Promise<SessionCall>;
}

// One engine call at a time per session: a second tap while the engine
// rebuilds would otherwise race the first one's answer.
export function sessionGate(session: () => number): SessionGate {
  let busySession = NO_SESSION;
  return {
    busy: () => busySession === session(),
    call: async (request) => {
      const opened = session();
      busySession = opened;
      const result = await request()
        .catch(() => KB_RESULT.KB_ERROR_INTERNAL)
        .finally(() => {
          if (busySession === opened) busySession = NO_SESSION;
        });
      return { result, live: opened === session() };
    },
  };
}
