import type { PlayQueueRepository } from '@kitbag/core-db';

export interface PlayOrderRepositories {
  readonly queue: PlayQueueRepository;
}

let configured: PlayOrderRepositories | undefined;

export function configurePlayOrder(repositories: PlayOrderRepositories): void {
  if (configured === undefined) {
    configured = repositories;
    return;
  }
  if (configured !== repositories) {
    throw new Error('Play order repositories are already configured');
  }
}

export function getPlayOrder(): PlayOrderRepositories {
  if (configured === undefined) {
    throw new Error('Play order repositories are not configured');
  }
  return configured;
}
