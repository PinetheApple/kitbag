import { open } from '@op-engineering/op-sqlite';

export function openConnection(name: string) {
  return open({ name });
}
