import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { TOOL_ENTRY_EXPORT, TOOL_REGISTRY_KEY } from '@kitbag/core-plugin-api';
import { DOWNLOADABLE_IMPORTS } from 'eslint-plugin-kitbag';

import { toolGlobalPrefix } from '../toolHost/bundleContract.ts';
import {
  APP_SHELL_DIR,
  appShellRequire,
  BuildError,
  MONOREPO_DIR,
} from './paths.ts';

interface Resolution {
  readonly type: string;
  readonly filePath?: string;
}

interface ResolutionContext {
  readonly originModulePath: string;
  readonly resolveRequest: ResolveRequest;
}

type ResolveRequest = (
  context: ResolutionContext,
  moduleName: string,
  platform: string | null,
) => Resolution;

interface MetroConfig {
  watchFolders: string[];
  resolver: { nodeModulesPaths: string[]; resolveRequest: ResolveRequest };
  serializer: {
    getModulesRunBeforeMainModule: () => string[];
    getPolyfills: () => string[];
    getRunModuleStatement: (moduleId: number | string) => string;
  };
  transformer: { globalPrefix: string; asyncRequireModulePath: string };
  maxWorkers: number;
  cacheStores: unknown[];
  reporter: { update: () => void };
}

interface Metro {
  runBuild: (
    config: MetroConfig,
    options: Record<string, unknown>,
  ) => Promise<{ code: string }>;
}

export interface BundleRequest {
  readonly toolDir: string;
  readonly entry: string;
  readonly id: string;
  readonly workDir: string;
}

const TYPE_ONLY_IMPORTS = new Set(['@kitbag/core-plugin-api']);
const METRO_REQUIRE = '__r';
const METRO_WORKERS = 1;
// The require polyfill reads ErrorUtils and nativeRequire; the rest are native entry points.
// Containment against collisions and casual reach only: the signature is the trust boundary.
export const SHADOWED_HOST_GLOBALS = [
  'ErrorUtils',
  'nativeRequire',
  '__turboModuleProxy',
  'nativeModuleProxy',
  '__fbBatchedBridge',
  '__fbBatchedBridgeConfig',
  '__fbGenNativeModule',
  'nativeCallSyncHook',
  'nativeFlushQueueImmediate',
  'nativeFabricUIManager',
  '__nativeComponentRegistry',
  '__workletsModuleProxy',
  '__workletsNetworking',
  '__KitbagHostObject',
];

function isInside(file: string, dir: string): boolean {
  const relative = path.relative(dir, file);
  return (
    relative !== '' && !relative.startsWith('..') && !path.isAbsolute(relative)
  );
}

function isPathImport(name: string): boolean {
  return name.startsWith('.') || path.isAbsolute(name);
}

function writeShims(shimDir: string): Map<string, string> {
  mkdirSync(shimDir, { recursive: true });
  const registry = `global[${JSON.stringify(TOOL_REGISTRY_KEY)}]`;
  return new Map(
    DOWNLOADABLE_IMPORTS.filter((name) => !TYPE_ONLY_IMPORTS.has(name)).map(
      (name) => {
        const file = path.join(shimDir, `${name.replace(/[@/]/g, '_')}.js`);
        writeFileSync(
          file,
          `if (!${registry}) throw new Error('${TOOL_REGISTRY_KEY} is not installed by the host');\n` +
            `module.exports = ${registry}.module(${JSON.stringify(name)});\n`,
        );
        return [name, file];
      },
    ),
  );
}

function toolResolver(
  request: BundleRequest,
  shims: Map<string, string>,
  asyncRequire: string,
): ResolveRequest {
  return (context, name, platform) => {
    const origin = context.originModulePath;
    if (!isInside(origin, request.toolDir)) {
      return name === asyncRequire
        ? { type: 'empty' }
        : context.resolveRequest(context, name, platform);
    }
    const where = path.relative(request.toolDir, origin);
    if (TYPE_ONLY_IMPORTS.has(name)) return { type: 'empty' };
    const shim = shims.get(name);
    if (shim !== undefined) return { type: 'sourceFile', filePath: shim };
    if (!isPathImport(name)) {
      throw new BuildError(
        `${where} imports ${name}, which is not on the downloadable allowlist`,
      );
    }
    const resolved = context.resolveRequest(context, name, platform);
    if (
      resolved.filePath === undefined ||
      !isInside(resolved.filePath, request.toolDir)
    ) {
      throw new BuildError(
        `${where} imports ${name}, which is outside the tool package`,
      );
    }
    return resolved;
  };
}

function runStatement(id: string, moduleId: number | string): string {
  return (
    `globalThis.${TOOL_REGISTRY_KEY}.register(${JSON.stringify(id)},` +
    `globalThis.${METRO_REQUIRE}(${JSON.stringify(moduleId)}).${TOOL_ENTRY_EXPORT});`
  );
}

function toolConfig(request: BundleRequest): MetroConfig {
  const { getDefaultConfig } = appShellRequire('expo/metro-config') as {
    getDefaultConfig: (root: string) => MetroConfig;
  };
  const config = getDefaultConfig(APP_SHELL_DIR);
  const shims = writeShims(path.join(request.workDir, 'shims'));
  config.watchFolders = [MONOREPO_DIR, request.toolDir, request.workDir];
  config.resolver.nodeModulesPaths = [
    path.join(APP_SHELL_DIR, 'node_modules'),
    path.join(MONOREPO_DIR, 'node_modules'),
  ];
  config.resolver.resolveRequest = toolResolver(
    request,
    shims,
    config.transformer.asyncRequireModulePath,
  );
  config.serializer.getModulesRunBeforeMainModule = () => [];
  config.serializer.getPolyfills = () => [];
  config.serializer.getRunModuleStatement = (moduleId) =>
    runStatement(request.id, moduleId);
  config.transformer.globalPrefix = toolGlobalPrefix(request.id);
  config.maxWorkers = METRO_WORKERS;
  config.cacheStores = [];
  config.reporter = { update: () => undefined };
  return config;
}

export function wrapBundle(js: string, id: string): string {
  const define = `${toolGlobalPrefix(id)}__d`;
  const shadowed = SHADOWED_HOST_GLOBALS.map(
    (name) => `${name}:{value:undefined,writable:true}`,
  );
  return [
    '(function (host) {',
    `var scope = Object.create(host, {${shadowed.join(',')}});`,
    '(function (globalThis, global) {',
    `function ${define}() { return globalThis.${define}.apply(undefined, arguments); }`,
    js,
    '})(scope, scope);',
    '})(globalThis);',
    '',
  ].join('\n');
}

export async function bundleTool(request: BundleRequest): Promise<string> {
  const metro = appShellRequire('metro') as Metro;
  const { code } = await metro.runBuild(toolConfig(request), {
    entry: request.entry,
    platform: 'android',
    dev: false,
    minify: true,
    customTransformOptions: { engine: 'hermes' },
  });
  return wrapBundle(code, request.id);
}
