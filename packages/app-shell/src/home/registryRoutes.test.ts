import { readdirSync, readFileSync } from 'node:fs';
import { join, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

import { BUILT_TOOL_IDS, HOME_TOOLS, TOOL_ID } from './registry.ts';
import { TOOL_ROUTES } from './toolRoutes.ts';

const APP = join(import.meta.dirname, '..', 'app');
const ROUTE_EXT = '.tsx';
const LAYOUT_FILE = /(^|\/)_layout$/;
const ROUTER_SPECIAL_FILE = /(^|\/)\+/;
const INDEX_SEGMENT = /(^|\/)index$/;
const GATE_CALL = /export default gated\(\s*TOOL_ID\.(\w+)/;

const SHELL_ROUTES: readonly string[] = [
  '/',
  '/gate',
  '/settings',
  '/settings/attributions',
  '/settings/calibrate',
  '/settings/restore',
  '/settings/tools',
];

type ToolKey = keyof typeof TOOL_ID;

function routePath(file: string): string {
  const path = file.split(sep).join('/').slice(0, -ROUTE_EXT.length);
  return `/${path.replace(INDEX_SEGMENT, '')}`;
}

function routeFiles(): readonly string[] {
  return readdirSync(APP, { recursive: true })
    .map(String)
    .filter(
      (f) =>
        f.endsWith(ROUTE_EXT) &&
        !LAYOUT_FILE.test(routePath(f)) &&
        !ROUTER_SPECIAL_FILE.test(routePath(f)),
    );
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
const DECLARED = HOME_TOOLS.flatMap((t) => t.routes.map((r) => r.path));

describe('tool routes', () => {
  it('gates each route file by the registry tool that owns it, and nothing else', () => {
    const gates = Object.fromEntries(
      FILES.map((f) => [routePath(f), gateOf(f)]),
    );
    const expected = Object.fromEntries(PATHS.map((p) => [p, expectedGate(p)]));
    expect(gates).toEqual(expected);
  });

  it('owns every route file by a registry tool or the shell', () => {
    const strays = PATHS.filter(
      (p) => !DECLARED.includes(p) && !SHELL_ROUTES.includes(p),
    );
    expect(strays).toEqual([]);
    expect(DECLARED.filter((p) => SHELL_ROUTES.includes(p))).toEqual([]);
  });

  it('builds each registry entry from its own route group', () => {
    const entries = Object.fromEntries(
      HOME_TOOLS.map((t) => [t.id, t.routes.map((r) => r.path)]),
    );
    const groups = Object.fromEntries(
      Object.entries(TOOL_ROUTES).map(([id, g]) => [id, Object.values(g)]),
    );
    expect(entries).toEqual(groups);
  });

  it('names only routes that have a route file', () => {
    expect(DECLARED.filter((p) => !PATHS.includes(p))).toEqual([]);
  });

  it('gives each route one owner', () => {
    expect(new Set(DECLARED).size).toBe(DECLARED.length);
  });

  it('opens each Home tile on one of its own routes', () => {
    const strays = HOME_TOOLS.filter(
      (t) => !t.routes.some((r) => r.path === t.homeTile?.route),
    ).map((t) => t.id);
    expect(strays).toEqual([]);
  });
});
