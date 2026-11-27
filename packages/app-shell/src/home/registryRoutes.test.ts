import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

import { BUILT_TOOL_IDS, HOME_TOOLS, TOOL_ID } from './registry.ts';

const APP = join(import.meta.dirname, '..', 'app');
const ROUTE_EXT = '.tsx';
const LAYOUT_FILE = /(^|\/)_layout$/;
const INDEX_SEGMENT = /(^|\/)index$/;
const GATE_CALL = /\bgated\(\s*TOOL_ID\.(\w+)/;

type ToolKey = keyof typeof TOOL_ID;

function routePath(file: string): string {
  const path = file.split(sep).join('/').slice(0, -ROUTE_EXT.length);
  return `/${path.replace(INDEX_SEGMENT, '')}`;
}

function routeFiles(): readonly string[] {
  return readdirSync(APP, { recursive: true })
    .map(String)
    .filter((f) => f.endsWith(ROUTE_EXT) && !LAYOUT_FILE.test(routePath(f)));
}

function gateOf(file: string): string | undefined {
  const key = GATE_CALL.exec(readFileSync(join(APP, file), 'utf8'))?.[1];
  return key === undefined ? undefined : TOOL_ID[key as ToolKey];
}

function expectedGate(path: string): string | undefined {
  const owner = HOME_TOOLS.find((t) => t.routes.some((r) => r.path === path));
  return owner !== undefined && BUILT_TOOL_IDS.includes(owner.id)
    ? owner.id
    : undefined;
}

const FILES = routeFiles();
const PATHS = FILES.map(routePath);

describe('tool routes', () => {
  it('gates each route file by the registry tool that owns it, and nothing else', () => {
    const gates = Object.fromEntries(
      FILES.map((f) => [routePath(f), gateOf(f)]),
    );
    const expected = Object.fromEntries(PATHS.map((p) => [p, expectedGate(p)]));
    expect(gates).toEqual(expected);
  });

  it('names only routes that have a route file', () => {
    const declared = HOME_TOOLS.flatMap((t) => t.routes.map((r) => r.path));
    expect(declared.filter((p) => !PATHS.includes(p))).toEqual([]);
  });

  it('gives each route one owner', () => {
    const declared = HOME_TOOLS.flatMap((t) => t.routes.map((r) => r.path));
    expect(new Set(declared).size).toBe(declared.length);
  });

  it('opens each Home tile on one of its own routes', () => {
    const strays = HOME_TOOLS.filter(
      (t) => !t.routes.some((r) => r.path === t.homeTile?.route),
    ).map((t) => t.id);
    expect(strays).toEqual([]);
  });
});
