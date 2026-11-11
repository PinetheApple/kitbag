export interface PendingClick {
  readonly pending: () => boolean;
  readonly begin: () => number;
  readonly finish: (turnOn: number) => boolean;
  readonly cancel: () => void;
}

export function createPendingClick(): PendingClick {
  let latest = 0;
  let pending = false;
  return {
    pending: () => pending,
    begin: () => {
      pending = true;
      latest++;
      return latest;
    },
    finish: (turnOn) => {
      const current = turnOn === latest;
      if (current) pending = false;
      return current;
    },
    cancel: () => {
      pending = false;
      latest++;
    },
  };
}
