// Ids and sizes are opaque: app-shell owns the roster, core-design the sizes.
// Visible tiles always precede hidden ones, which keep the order they were hidden in.

export interface ArrangedTile<Size extends string> {
  readonly toolId: string;
  readonly size: Size;
  readonly hidden: boolean;
}

export type Arrangement<Size extends string> = readonly ArrangedTile<Size>[];

export function visibleTiles<Size extends string>(
  arrangement: Arrangement<Size>,
): Arrangement<Size> {
  return arrangement.filter((t) => !t.hidden);
}

export function hiddenTiles<Size extends string>(
  arrangement: Arrangement<Size>,
): Arrangement<Size> {
  return arrangement.filter((t) => t.hidden);
}

function without<Size extends string>(
  arrangement: Arrangement<Size>,
  toolId: string,
): ArrangedTile<Size>[] {
  return arrangement.filter((t) => t.toolId !== toolId);
}

export function moveTile<Size extends string>(
  arrangement: Arrangement<Size>,
  toolId: string,
  to: number,
): Arrangement<Size> {
  const visible = visibleTiles(arrangement);
  const from = visible.findIndex((t) => t.toolId === toolId);
  const target = Math.min(Math.max(to, 0), visible.length - 1);
  const moving = visible[from];
  if (moving === undefined || target === from) return arrangement;
  const reordered = without(visible, toolId);
  reordered.splice(target, 0, moving);
  return [...reordered, ...hiddenTiles(arrangement)];
}

export function resizeTile<Size extends string>(
  arrangement: Arrangement<Size>,
  toolId: string,
  size: Size,
): Arrangement<Size> {
  const current = arrangement.find((t) => t.toolId === toolId);
  if (current === undefined || current.size === size) return arrangement;
  return arrangement.map((t) => (t.toolId === toolId ? { ...t, size } : t));
}

export function hideTile<Size extends string>(
  arrangement: Arrangement<Size>,
  toolId: string,
): Arrangement<Size> {
  const current = arrangement.find((t) => t.toolId === toolId);
  if (current === undefined || current.hidden) return arrangement;
  return [...without(arrangement, toolId), { ...current, hidden: true }];
}

export function showTile<Size extends string>(
  arrangement: Arrangement<Size>,
  toolId: string,
): Arrangement<Size> {
  const current = arrangement.find((t) => t.toolId === toolId);
  if (current?.hidden !== true) return arrangement;
  const rest = without(arrangement, toolId);
  return [
    ...visibleTiles(rest),
    { ...current, hidden: false },
    ...hiddenTiles(rest),
  ];
}

export function reconcileArrangement<Size extends string>(
  saved: Arrangement<string> | undefined,
  defaults: Arrangement<Size>,
  isSize: (size: string) => size is Size,
): Arrangement<Size> {
  if (saved === undefined) return defaults;
  const known = new Map(defaults.map((t) => [t.toolId, t]));
  const kept = new Map<string, ArrangedTile<Size>>();
  for (const entry of saved) {
    const fallback = known.get(entry.toolId);
    if (fallback === undefined || kept.has(entry.toolId)) continue;
    const size = isSize(entry.size) ? entry.size : fallback.size;
    kept.set(entry.toolId, {
      toolId: entry.toolId,
      size,
      hidden: entry.hidden,
    });
  }
  const restored = [...kept.values()];
  const added = defaults.filter((t) => !kept.has(t.toolId));
  return [...visibleTiles(restored), ...added, ...hiddenTiles(restored)];
}
