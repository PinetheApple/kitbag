import type { ToolStore } from '@kitbag/core-plugin-api';
import { create } from 'zustand';

export function createToolStore<S extends object>(initial: S): ToolStore<S> {
  return create<S>()(() => initial);
}
