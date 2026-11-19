interface Ordered {
  readonly id: number;
}

export interface Placement<T> {
  readonly ordered: T[];
  readonly position: number;
}

export function placeAt<T extends Ordered>(
  items: readonly T[],
  item: T,
  position: number | undefined,
): Placement<T> {
  const ordered = items.filter((entry) => entry.id !== item.id);
  const target = Math.max(
    0,
    Math.min(position ?? ordered.length, ordered.length),
  );
  ordered.splice(target, 0, item);
  return { ordered, position: target };
}
