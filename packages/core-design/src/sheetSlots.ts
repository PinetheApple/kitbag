import type { ReactNode } from 'react';

export interface SheetSlot {
  readonly id: string;
  readonly node: ReactNode;
}

/** Puts a sheet's content in its slot, keeping the order sheets opened in. */
export function upsertSheet(
  slots: readonly SheetSlot[],
  id: string,
  node: ReactNode,
): readonly SheetSlot[] {
  const index = slots.findIndex((slot) => slot.id === id);
  if (index === -1) return [...slots, { id, node }];
  return slots.map((slot, i) => (i === index ? { id, node } : slot));
}

export function removeSheet(
  slots: readonly SheetSlot[],
  id: string,
): readonly SheetSlot[] {
  return slots.some((slot) => slot.id === id)
    ? slots.filter((slot) => slot.id !== id)
    : slots;
}
