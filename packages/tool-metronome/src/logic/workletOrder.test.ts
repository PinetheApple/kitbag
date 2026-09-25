import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const WORKLET_FN = /export function (\w+)\([^)]*\)[^{]*\{\s*'worklet';/g;

function workletDeclarationOrder(source: string): string[] {
  return Array.from(source.matchAll(WORKLET_FN), (match) => match[1] ?? '');
}

describe('swipeTempo worklets', () => {
  it('declares every worklet before any worklet that calls it', () => {
    const source = readFileSync(
      new URL('./swipeTempo.ts', import.meta.url).pathname,
      'utf8',
    );
    const order = workletDeclarationOrder(source);
    expect(order.length).toBeGreaterThan(1);

    for (const [index, name] of order.entries()) {
      const start = source.indexOf(`export function ${name}(`);
      const next = order[index + 1];
      const end =
        next === undefined
          ? source.length
          : source.indexOf(`export function ${next}(`);
      const body = source.slice(start, end);
      for (const later of order.slice(index + 1)) {
        expect(body.includes(`${later}(`), `${name} calls ${later}`).toBe(
          false,
        );
      }
    }
  });
});
