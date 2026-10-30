export type EngineUser = 'metronome' | 'stems';

export interface EngineUsers {
  readonly claim: (user: EngineUser) => void;
  readonly release: (user: EngineUser) => boolean;
}

// release is true when it freed the last user, so the caller stops the stream.
export function createEngineUsers(): EngineUsers {
  const users = new Set<EngineUser>();
  return {
    claim: (user) => {
      users.add(user);
    },
    release: (user) => users.delete(user) && users.size === 0,
  };
}

export const engineUsers = createEngineUsers();
