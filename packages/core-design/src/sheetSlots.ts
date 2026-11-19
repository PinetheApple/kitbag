import type { ReactNode } from 'react';

export type SheetSlotState = 'open' | 'leaving';

export interface SheetSlot {
  readonly id: string;
  readonly node: ReactNode;
  readonly state: SheetSlotState;
}

/** Puts a sheet's content in its slot, keeping the order sheets opened in. */
export function upsertSheet(
  slots: readonly SheetSlot[],
  id: string,
  node: ReactNode,
  state: SheetSlotState,
): readonly SheetSlot[] {
  const index = slots.findIndex((slot) => slot.id === id);
  const next = { id, node, state };
  if (index === -1) return [...slots, next];
  if (slots[index]?.state === 'leaving' && state === 'open')
    return [...slots.filter((slot) => slot.id !== id), next];
  return slots.map((slot, i) => (i === index ? next : slot));
}

export function removeSheet(
  slots: readonly SheetSlot[],
  id: string,
): readonly SheetSlot[] {
  return slots.some((slot) => slot.id === id)
    ? slots.filter((slot) => slot.id !== id)
    : slots;
}
