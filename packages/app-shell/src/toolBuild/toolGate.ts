import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { HOST_API } from '../toolHost/hostApi.ts';
import {
  hbcBytecodeVersion,
  hermescBytecodeVersion,
  installedRuntime,
} from './hermes.ts';
import {
  BUNDLE_ENTRY,
  INDEX_FILE,
  INDEX_SIG_FILE,
  isJsonObject,
  kbtAssetName,
  MANIFEST_FILE,
  MANIFEST_SIG_FILE,
  manifestProblems,
  SCHEMA_VERSION,
  signatureProblem,
  TEST_KEY_PREFIX,
  type PinnedKey,
  type ToolIndex,
  type ToolIndexEntry,
  type ToolKeys,
  type ToolManifest,
} from './manifest.ts';
import { BuildError } from './paths.ts';
import { sha256, verifyEs256 } from './signature.ts';
import { kbtFiles, type HostRelease } from './toolSet.ts';
import { readZip, ZipError, type ZipEntry } from './zip.ts';

export interface GateRequest {
  readonly dir: string;
  readonly keysFile: string;
  readonly host: HostRelease;
  readonly release: boolean;
}

interface Signed {
  readonly label: string;
  readonly bytes: Buffer;
  readonly signature: Buffer;
  readonly keyId: string;
}

interface OpenedBundle {
  readonly entries: readonly ZipEntry[];
  readonly manifestBytes: Buffer;
  readonly signature: Buffer;
  readonly manifest: ToolManifest;
}

const SIGNING_STATUSES = new Set(['current', 'next']);
const LISTED_FIELDS = [
  'id',
  'version',
  'name',
  'icon',
  'summary',
  'changelog',
] as const;

class Findings {
  readonly problems: string[] = [];

  check(ok: boolean, problem: string): boolean {
    if (!ok) this.problems.push(problem);
    return ok;
  }
}

function readKeys(keysFile: string): readonly PinnedKey[] {
  const pins: unknown = JSON.parse(readFileSync(keysFile, 'utf8'));
  if (
    !isJsonObject(pins) ||
    pins.schema !== SCHEMA_VERSION ||
    !Array.isArray(pins.keys)
  ) {
    throw new BuildError(
      `${keysFile} is not a schema ${String(SCHEMA_VERSION)} pin file`,
    );
  }
  return (pins as unknown as ToolKeys).keys;
}

function verifySigned(
  signed: Signed,
  keys: readonly PinnedKey[],
  findings: Findings,
): void {
  const { label, keyId } = signed;
  const key = keys.find(
    (k) =>
      k.keyId === keyId &&
      k.role === 'tools' &&
      SIGNING_STATUSES.has(k.status ?? ''),
  );
  if (key === undefined) {
    findings.check(
      false,
      `${label} is signed by ${keyId}, which is not a pinned current or next tool key`,
    );
    return;
  }
  findings.check(
    verifyEs256(signed.bytes, signed.signature, key.spkiBase64),
    `${label} does not verify with ${keyId}`,
  );
}

function checkFiles(
  asset: string,
  opened: OpenedBundle,
  findings: Findings,
): void {
  const { entries, manifest } = opened;
  const listed = new Set(manifest.files.map((file) => file.path));
  const names = entries.map((entry) => entry.name);
  for (const name of names) {
    findings.check(
      names.indexOf(name) === names.lastIndexOf(name),
      `${asset}: ${name} appears twice`,
    );
    findings.check(
      name === MANIFEST_FILE || name === MANIFEST_SIG_FILE || listed.has(name),
      `${asset}: ${name} is not listed in the manifest`,
    );
  }
  for (const file of manifest.files) {
    const data = entries.find((e) => e.name === file.path)?.data;
    if (
      !findings.check(data !== undefined, `${asset}: ${file.path} is missing`)
    )
      continue;
    findings.check(
      data?.length === file.size,
      `${asset}: ${file.path} size does not match the manifest`,
    );
    findings.check(
      data !== undefined && sha256(data) === file.sha256,
      `${asset}: ${file.path} sha256 does not match the manifest`,
    );
  }
}

function checkRuntime(
  asset: string,
  opened: OpenedBundle,
  findings: Findings,
): void {
  const { entries, manifest } = opened;
  const bytecode = hermescBytecodeVersion();
  const hbc = entries.find((e) => e.name === BUNDLE_ENTRY)?.data;
  findings.check(
    hbc !== undefined &&
      hbcBytecodeVersion(hbc) === bytecode &&
      manifest.runtime.hermesBytecodeVersion === bytecode,
    `${asset}: ${BUNDLE_ENTRY} is not Hermes bytecode version ${String(bytecode)}, this host's hermesc`,
  );
  const runtime = installedRuntime();
  for (const [name, version] of Object.entries(runtime)) {
    const pinned = manifest.runtime[name as keyof typeof runtime];
    findings.check(
      pinned === version,
      `${asset}: runtime.${name} ${pinned} is not this host's ${version}`,
    );
  }
}

function checkHostFit(
  asset: string,
  manifest: ToolManifest,
  index: ToolIndex,
  findings: Findings,
): void {
  const { host, hostApi } = manifest;
  findings.check(
    hostApi.major === index.hostApi.major &&
      hostApi.minMinor <= index.hostApi.minor,
    `${asset}: hostApi ${String(hostApi.major)}.${String(hostApi.minMinor)} does not fit the host's`,
  );
  findings.check(
    host.builtWith === index.host.versionName &&
      host.minVersionCode <= index.host.versionCode &&
      (host.maxVersionCode === null ||
        index.host.versionCode <= host.maxVersionCode),
    `${asset}: built for host ${host.builtWith}, not ${index.host.versionName}`,
  );
}

function checkListing(
  entry: ToolIndexEntry,
  opened: OpenedBundle,
  findings: Findings,
): void {
  const { asset } = entry;
  const { manifest } = opened;
  findings.check(
    sha256(opened.manifestBytes) === entry.manifestSha256,
    `${asset}: manifestSha256 does not match`,
  );
  findings.check(
    asset === kbtAssetName(manifest.id, manifest.version),
    `${asset}: name does not match its manifest`,
  );
  for (const field of LISTED_FIELDS) {
    findings.check(
      entry[field] === manifest[field],
      `${asset}: index ${field} differs from the manifest`,
    );
  }
  findings.check(
    JSON.stringify(entry.capabilities) ===
      JSON.stringify(manifest.capabilities),
    `${asset}: index capabilities differ from the manifest`,
  );
}

function unzip(
  asset: string,
  kbt: Buffer,
  findings: Findings,
): ZipEntry[] | undefined {
  try {
    return readZip(kbt);
  } catch (error) {
    if (!(error instanceof ZipError)) throw error;
    findings.check(false, `${asset}: ${error.message}`);
    return undefined;
  }
}

function parseSignedManifest(
  asset: string,
  bytes: Buffer,
  findings: Findings,
): ToolManifest | undefined {
  let raw: unknown;
  try {
    raw = JSON.parse(bytes.toString('utf8'));
  } catch {
    findings.check(false, `${asset}: ${MANIFEST_FILE} is not JSON`);
    return undefined;
  }
  const problems = manifestProblems(raw, { signed: true });
  for (const problem of problems) findings.check(false, `${asset}: ${problem}`);
  return problems.length === 0 ? (raw as ToolManifest) : undefined;
}

function openBundle(
  dir: string,
  entry: ToolIndexEntry,
  findings: Findings,
): OpenedBundle | undefined {
  const { asset } = entry;
  const file = path.join(dir, asset);
  if (
    !findings.check(
      existsSync(file),
      `${asset} is in the index but not in ${dir}`,
    )
  )
    return undefined;
  const kbt = readFileSync(file);
  findings.check(
    kbt.length === entry.size,
    `${asset}: size does not match the index`,
  );
  findings.check(
    sha256(kbt) === entry.kbtSha256,
    `${asset}: kbtSha256 does not match the index`,
  );
  const entries = unzip(asset, kbt, findings);
  if (entries === undefined) return undefined;
  const manifestBytes = entries.find((e) => e.name === MANIFEST_FILE)?.data;
  const signature = entries.find((e) => e.name === MANIFEST_SIG_FILE)?.data;
  if (manifestBytes === undefined || signature === undefined) {
    findings.check(
      false,
      `${asset}: no ${MANIFEST_FILE} or ${MANIFEST_SIG_FILE}`,
    );
    return undefined;
  }
  const manifest = parseSignedManifest(asset, manifestBytes, findings);
  return manifest === undefined
    ? undefined
    : { entries, manifestBytes, signature, manifest };
}

function gateBundle(
  request: GateRequest,
  entry: ToolIndexEntry,
  index: ToolIndex,
  keys: readonly PinnedKey[],
  findings: Findings,
): void {
  const opened = openBundle(request.dir, entry, findings);
  if (opened === undefined) return;
  const { asset } = entry;
  const keyId = opened.manifest.signature?.keyId ?? '';
  const label = `${asset}: ${MANIFEST_SIG_FILE}`;
  verifySigned(
    { label, bytes: opened.manifestBytes, signature: opened.signature, keyId },
    keys,
    findings,
  );
  if (request.release) checkNotTestKey(label, keyId, findings);
  checkFiles(asset, opened, findings);
  checkRuntime(asset, opened, findings);
  checkHostFit(asset, opened.manifest, index, findings);
  checkListing(entry, opened, findings);
}

function checkNotTestKey(
  label: string,
  keyId: string,
  findings: Findings,
): void {
  findings.check(
    !keyId.startsWith(TEST_KEY_PREFIX),
    `${label} is signed by ${keyId}; a release is signed by no ${TEST_KEY_PREFIX} key`,
  );
}

function checkIndex(
  raw: unknown,
  request: GateRequest,
  findings: Findings,
): ToolIndex | undefined {
  const ok = findings.check(
    isJsonObject(raw) &&
      raw.schema === SCHEMA_VERSION &&
      Array.isArray(raw.tools) &&
      isJsonObject(raw.host),
    `${INDEX_FILE} is not a schema ${String(SCHEMA_VERSION)} index`,
  );
  const problem = ok
    ? signatureProblem((raw as ToolIndex).signature)
    : undefined;
  if (!ok || problem !== undefined) {
    if (problem !== undefined)
      findings.check(false, `${INDEX_FILE}: ${problem}`);
    return undefined;
  }
  const index = raw as ToolIndex;
  const { host } = request;
  findings.check(
    index.host.versionName === host.versionName &&
      index.host.versionCode === host.versionCode,
    `${INDEX_FILE} is for host ${index.host.versionName} (${String(index.host.versionCode)}), not ${host.versionName} (${String(host.versionCode)})`,
  );
  findings.check(
    index.hostApi.major === HOST_API.major &&
      index.hostApi.minor === HOST_API.minor,
    `${INDEX_FILE} hostApi is not this host's ${String(HOST_API.major)}.${String(HOST_API.minor)}`,
  );
  const ids = index.tools.map((tool) => tool.id);
  findings.check(
    new Set(ids).size === ids.length,
    `${INDEX_FILE} lists a tool id twice`,
  );
  return index;
}

export function gateToolSet(request: GateRequest): string[] {
  const findings = new Findings();
  const keys = readKeys(request.keysFile);
  if (request.release) {
    for (const key of keys) {
      findings.check(
        !key.keyId.startsWith(TEST_KEY_PREFIX),
        `the pin file holds ${key.keyId}; a release pins no ${TEST_KEY_PREFIX} key`,
      );
    }
  }
  const indexPath = path.join(request.dir, INDEX_FILE);
  const sigPath = path.join(request.dir, INDEX_SIG_FILE);
  if (
    !findings.check(
      existsSync(indexPath) && existsSync(sigPath),
      `no ${INDEX_FILE} and ${INDEX_SIG_FILE} in ${request.dir}`,
    )
  ) {
    return findings.problems;
  }
  const bytes = readFileSync(indexPath);
  const index = checkIndex(
    JSON.parse(bytes.toString('utf8')),
    request,
    findings,
  );
  if (index === undefined) return findings.problems;
  const { keyId } = index.signature;
  verifySigned(
    { label: INDEX_FILE, bytes, signature: readFileSync(sigPath), keyId },
    keys,
    findings,
  );
  if (request.release) checkNotTestKey(INDEX_FILE, keyId, findings);
  const listed = new Set(index.tools.map((tool) => tool.asset));
  for (const asset of kbtFiles(request.dir))
    findings.check(listed.has(asset), `${asset} is not in ${INDEX_FILE}`);
  for (const entry of index.tools)
    gateBundle(request, entry, index, keys, findings);
  return findings.problems;
}
