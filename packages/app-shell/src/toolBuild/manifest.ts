import type { HostApiVersion } from '@kitbag/core-plugin-api';

export const SCHEMA_VERSION = 1;
export const SIGNATURE_ALG = 'ES256';
export const BUNDLE_ENTRY = 'bundle.hbc';
export const ASSETS_DIR = 'assets';
export const MANIFEST_FILE = 'manifest.json';
export const MANIFEST_SIG_FILE = 'manifest.sig';
export const INDEX_FILE = 'tools-index.json';
export const INDEX_SIG_FILE = `${INDEX_FILE}.sig`;
export const KBT_EXTENSION = '.kbt';
export const TEST_KEY_PREFIX = 'test-';

const ID = /^[a-z][a-z0-9-]{1,31}$/;
const SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
const SHA256 = /^[0-9a-f]{64}$/;
const FILE_PATH = /^(bundle\.hbc|assets\/[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*)$/;
const ROUTE = /^\/t\/[a-z][a-z0-9-]{1,31}(\/[A-Za-z0-9[\]._-]+)*$/;
const NAME_MAX = 40;
const SUMMARY_MAX = 80;
const CHANGELOG_MAX = 500;

export interface ManifestFile {
  readonly path: string;
  readonly sha256: string;
  readonly size: number;
}

export interface ToolSignature {
  readonly alg: typeof SIGNATURE_ALG;
  readonly keyId: string;
}

export interface RuntimePins {
  readonly hermesBytecodeVersion: number;
  readonly reactNative: string;
  readonly react: string;
  readonly reanimated: string;
  readonly worklets: string;
}

export interface ToolMetadata {
  readonly id: string;
  readonly name: string;
  readonly icon: string;
  readonly summary?: string;
  readonly routes: readonly string[];
  readonly homeTile?: { readonly label: string; readonly route: string };
  readonly capabilities: readonly string[];
  readonly requires?: readonly string[];
  readonly changelog?: string;
}

export interface ToolManifest extends ToolMetadata {
  readonly schema: typeof SCHEMA_VERSION;
  readonly version: string;
  readonly hostApi: { readonly major: number; readonly minMinor: number };
  readonly host: {
    readonly minVersionCode: number;
    readonly maxVersionCode: number | null;
    readonly builtWith: string;
  };
  readonly runtime: RuntimePins;
  readonly entry: typeof BUNDLE_ENTRY;
  readonly files: readonly ManifestFile[];
  readonly size: number;
  readonly signature?: ToolSignature;
}

export interface ToolIndexEntry {
  readonly id: string;
  readonly version: string;
  readonly name: string;
  readonly icon: string;
  readonly summary?: string;
  readonly asset: string;
  readonly size: number;
  readonly kbtSha256: string;
  readonly manifestSha256: string;
  readonly capabilities: readonly string[];
  readonly changelog?: string;
}

export interface ToolIndex {
  readonly schema: typeof SCHEMA_VERSION;
  readonly host: { readonly versionName: string; readonly versionCode: number };
  readonly hostApi: HostApiVersion;
  readonly signature: ToolSignature;
  readonly tools: readonly ToolIndexEntry[];
}

export interface PinnedKey {
  readonly keyId: string;
  readonly role: 'tools' | 'revocation';
  readonly status?: 'current' | 'next' | 'retired';
  readonly spkiBase64: string;
}

export interface ToolKeys {
  readonly schema: typeof SCHEMA_VERSION;
  readonly keys: readonly PinnedKey[];
}

const MANIFEST_KEYS = new Set([
  'schema',
  'id',
  'name',
  'version',
  'icon',
  'summary',
  'hostApi',
  'host',
  'runtime',
  'entry',
  'files',
  'size',
  'routes',
  'homeTile',
  'capabilities',
  'requires',
  'changelog',
  'signature',
]);

type Json = Readonly<Record<string, unknown>>;

export function kbtAssetName(id: string, version: string): string {
  return `tool-${id}-${version}${KBT_EXTENSION}`;
}

export function isJsonObject(value: unknown): value is Json {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isInt(value: unknown, min = Number.MIN_SAFE_INTEGER): value is number {
  return Number.isSafeInteger(value) && (value as number) >= min;
}

function isText(
  value: unknown,
  pattern?: RegExp,
  max?: number,
): value is string {
  return (
    typeof value === 'string' &&
    (pattern === undefined || pattern.test(value)) &&
    (max === undefined || value.length <= max)
  );
}

function isTextList(value: unknown, pattern?: RegExp): value is string[] {
  return Array.isArray(value) && value.every((item) => isText(item, pattern));
}

function optional(
  value: unknown,
  check: (present: unknown) => boolean,
): boolean {
  return value === undefined || check(value);
}

class Problems {
  readonly list: string[] = [];

  expect(ok: boolean, problem: string): boolean {
    if (!ok) this.list.push(problem);
    return ok;
  }
}

function isManifestFile(file: unknown): file is ManifestFile {
  return (
    isJsonObject(file) &&
    isText(file.path, FILE_PATH) &&
    isText(file.sha256, SHA256) &&
    isInt(file.size, 0)
  );
}

function checkFiles(files: unknown, problems: Problems): number | undefined {
  if (
    !problems.expect(
      Array.isArray(files) && files.length > 0,
      'files must list at least one file',
    )
  ) {
    return undefined;
  }
  const entries = files as unknown[];
  const paths = new Set<string>();
  let total = 0;
  for (const file of entries) {
    if (!isManifestFile(file)) {
      problems.list.push(`files entry ${JSON.stringify(file)} is malformed`);
      continue;
    }
    const { path, size } = file;
    problems.expect(!paths.has(path), `files lists ${path} twice`);
    paths.add(path);
    total += size;
  }
  problems.expect(paths.has(BUNDLE_ENTRY), `files must list ${BUNDLE_ENTRY}`);
  return total;
}

function checkRoutes(m: Json, problems: Problems): void {
  const prefix = `/t/${String(m.id)}`;
  const routes = m.routes;
  if (
    !problems.expect(
      isTextList(routes, ROUTE) && routes.length > 0,
      'routes must hold at least one /t/ route',
    )
  ) {
    return;
  }
  for (const route of routes as string[]) {
    problems.expect(
      route === prefix || route.startsWith(`${prefix}/`),
      `route ${route} is outside ${prefix}`,
    );
  }
  const tile = m.homeTile;
  if (tile === undefined) return;
  problems.expect(
    isJsonObject(tile) &&
      isText(tile.label, undefined, NAME_MAX) &&
      (routes as unknown[]).includes(tile.route),
    'homeTile needs a label and a route from routes',
  );
}

function checkIdentity(m: Json, problems: Problems): void {
  problems.expect(
    m.schema === SCHEMA_VERSION,
    `schema must be ${String(SCHEMA_VERSION)}`,
  );
  problems.expect(
    isText(m.id, ID),
    `id ${JSON.stringify(m.id)} is not a tool id`,
  );
  problems.expect(
    isText(m.name, undefined, NAME_MAX),
    `name must be text of at most ${String(NAME_MAX)}`,
  );
  problems.expect(
    isText(m.version, SEMVER),
    `version ${JSON.stringify(m.version)} is not semver`,
  );
  problems.expect(isText(m.icon), 'icon must be text');
  problems.expect(
    optional(m.summary, (s) => isText(s, undefined, SUMMARY_MAX)),
    'summary is too long',
  );
  problems.expect(
    optional(m.changelog, (c) => isText(c, undefined, CHANGELOG_MAX)),
    'changelog is too long',
  );
  problems.expect(
    isTextList(m.capabilities),
    'capabilities must be a list of names',
  );
  problems.expect(
    optional(
      m.requires,
      (r) =>
        isTextList(r, ID) &&
        new Set(r).size === r.length &&
        !r.includes(String(m.id)),
    ),
    'requires must list other tool ids once each',
  );
}

function checkCompatibility(m: Json, problems: Problems): void {
  const { hostApi, host, runtime } = m;
  problems.expect(
    isJsonObject(hostApi) &&
      isInt(hostApi.major, 0) &&
      isInt(hostApi.minMinor, 0),
    'hostApi needs integer major and minMinor',
  );
  problems.expect(
    isJsonObject(host) &&
      isInt(host.minVersionCode, 0) &&
      (host.maxVersionCode === null || isInt(host.maxVersionCode, 0)) &&
      isText(host.builtWith, SEMVER),
    'host needs minVersionCode, maxVersionCode and builtWith',
  );
  problems.expect(
    isJsonObject(runtime) &&
      isInt(runtime.hermesBytecodeVersion, 0) &&
      [
        runtime.reactNative,
        runtime.react,
        runtime.reanimated,
        runtime.worklets,
      ].every((v) => isText(v)),
    'runtime needs the bytecode version and the React Native, React, Reanimated and worklets versions',
  );
}

export function signatureProblem(signature: unknown): string | undefined {
  const ok =
    isJsonObject(signature) &&
    signature.alg === SIGNATURE_ALG &&
    isText(signature.keyId, ID);
  return ok ? undefined : `signature must be { alg: ${SIGNATURE_ALG}, keyId }`;
}

export function manifestProblems(
  value: unknown,
  { signed }: { readonly signed: boolean },
): string[] {
  const problems = new Problems();
  if (!problems.expect(isJsonObject(value), 'manifest is not a JSON object'))
    return problems.list;
  const m = value as Json;
  for (const key of Object.keys(m))
    problems.expect(MANIFEST_KEYS.has(key), `unknown manifest field ${key}`);
  checkIdentity(m, problems);
  checkCompatibility(m, problems);
  checkRoutes(m, problems);
  problems.expect(m.entry === BUNDLE_ENTRY, `entry must be ${BUNDLE_ENTRY}`);
  const total = checkFiles(m.files, problems);
  problems.expect(
    total === undefined || m.size === total,
    'size is not the sum of files[].size',
  );
  if (signed) {
    const problem = signatureProblem(m.signature);
    if (problem !== undefined) problems.list.push(problem);
  } else {
    problems.expect(
      m.signature === undefined,
      'an unsigned manifest carries no signature',
    );
  }
  return problems.list;
}
