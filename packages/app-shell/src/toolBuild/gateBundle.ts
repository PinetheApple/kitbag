import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { checkNotTestKey, verifySigned } from './gateKeys.ts';
import {
  hbcBytecodeVersion,
  hermescBytecodeVersion,
  installedRuntime,
} from './hermes.ts';
import {
  BUNDLE_ENTRY,
  kbtAssetName,
  MANIFEST_FILE,
  MANIFEST_SIG_FILE,
  manifestProblems,
  type PinnedKey,
  type ToolIndex,
  type ToolIndexEntry,
  type ToolManifest,
} from './manifest.ts';
import type { Problems } from './problems.ts';
import { sha256 } from './signature.ts';
import { readZip, ZipError, type ZipEntry } from './zip.ts';

export interface BundleContext {
  readonly dir: string;
  readonly index: ToolIndex;
  readonly keys: readonly PinnedKey[];
  readonly release: boolean;
}

interface OpenedBundle {
  readonly entries: readonly ZipEntry[];
  readonly manifestBytes: Buffer;
  readonly signature: Buffer;
  readonly manifest: ToolManifest;
}

const LISTED_FIELDS = [
  'id',
  'version',
  'name',
  'icon',
  'summary',
  'changelog',
] as const;

function checkFiles(
  asset: string,
  opened: OpenedBundle,
  problems: Problems,
): void {
  const { entries, manifest } = opened;
  const listed = new Set(manifest.files.map((file) => file.path));
  const names = entries.map((entry) => entry.name);
  for (const name of names) {
    problems.check(
      names.indexOf(name) === names.lastIndexOf(name),
      `${asset}: ${name} appears twice`,
    );
    problems.check(
      name === MANIFEST_FILE || name === MANIFEST_SIG_FILE || listed.has(name),
      `${asset}: ${name} is not listed in the manifest`,
    );
  }
  for (const file of manifest.files) {
    const data = entries.find((e) => e.name === file.path)?.data;
    if (data === undefined) {
      problems.add(`${asset}: ${file.path} is missing`);
      continue;
    }
    problems.check(
      data.length === file.size,
      `${asset}: ${file.path} size does not match the manifest`,
    );
    problems.check(
      sha256(data) === file.sha256,
      `${asset}: ${file.path} sha256 does not match the manifest`,
    );
  }
}

function checkRuntime(
  asset: string,
  opened: OpenedBundle,
  problems: Problems,
): void {
  const { entries, manifest } = opened;
  const bytecode = hermescBytecodeVersion();
  const hbc = entries.find((e) => e.name === BUNDLE_ENTRY)?.data;
  problems.check(
    hbc !== undefined &&
      hbcBytecodeVersion(hbc) === bytecode &&
      manifest.runtime.hermesBytecodeVersion === bytecode,
    `${asset}: ${BUNDLE_ENTRY} is not Hermes bytecode version ${String(bytecode)}, this host's hermesc`,
  );
  const runtime = installedRuntime();
  for (const [name, version] of Object.entries(runtime)) {
    const pinned = manifest.runtime[name as keyof typeof runtime];
    problems.check(
      pinned === version,
      `${asset}: runtime.${name} ${pinned} is not this host's ${version}`,
    );
  }
}

function checkHostFit(
  asset: string,
  manifest: ToolManifest,
  index: ToolIndex,
  problems: Problems,
): void {
  const { host, hostApi } = manifest;
  problems.check(
    hostApi.major === index.hostApi.major &&
      hostApi.minMinor <= index.hostApi.minor,
    `${asset}: hostApi ${String(hostApi.major)}.${String(hostApi.minMinor)} does not fit the host's`,
  );
  problems.check(
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
  problems: Problems,
): void {
  const { asset } = entry;
  const { manifest } = opened;
  problems.check(
    sha256(opened.manifestBytes) === entry.manifestSha256,
    `${asset}: manifestSha256 does not match`,
  );
  problems.check(
    asset === kbtAssetName(manifest.id, manifest.version),
    `${asset}: name does not match its manifest`,
  );
  for (const field of LISTED_FIELDS) {
    problems.check(
      entry[field] === manifest[field],
      `${asset}: index ${field} differs from the manifest`,
    );
  }
  problems.check(
    JSON.stringify(entry.capabilities) ===
      JSON.stringify(manifest.capabilities),
    `${asset}: index capabilities differ from the manifest`,
  );
}

function unzip(
  asset: string,
  kbt: Buffer,
  problems: Problems,
): ZipEntry[] | undefined {
  try {
    return readZip(kbt);
  } catch (error) {
    if (!(error instanceof ZipError)) throw error;
    problems.add(`${asset}: ${error.message}`);
    return undefined;
  }
}

function parseSignedManifest(
  asset: string,
  bytes: Buffer,
  problems: Problems,
): ToolManifest | undefined {
  let raw: unknown;
  try {
    raw = JSON.parse(bytes.toString('utf8'));
  } catch {
    problems.add(`${asset}: ${MANIFEST_FILE} is not JSON`);
    return undefined;
  }
  const found = manifestProblems(raw, { signed: true });
  for (const problem of found) problems.add(`${asset}: ${problem}`);
  return found.length === 0 ? (raw as ToolManifest) : undefined;
}

function openBundle(
  dir: string,
  entry: ToolIndexEntry,
  problems: Problems,
): OpenedBundle | undefined {
  const { asset } = entry;
  const file = path.join(dir, asset);
  if (
    !problems.check(
      existsSync(file),
      `${asset} is in the index but not in ${dir}`,
    )
  )
    return undefined;
  const kbt = readFileSync(file);
  problems.check(
    kbt.length === entry.size,
    `${asset}: size does not match the index`,
  );
  problems.check(
    sha256(kbt) === entry.kbtSha256,
    `${asset}: kbtSha256 does not match the index`,
  );
  const entries = unzip(asset, kbt, problems);
  if (entries === undefined) return undefined;
  const manifestBytes = entries.find((e) => e.name === MANIFEST_FILE)?.data;
  const signature = entries.find((e) => e.name === MANIFEST_SIG_FILE)?.data;
  if (manifestBytes === undefined || signature === undefined) {
    problems.add(`${asset}: no ${MANIFEST_FILE} or ${MANIFEST_SIG_FILE}`);
    return undefined;
  }
  const manifest = parseSignedManifest(asset, manifestBytes, problems);
  return manifest === undefined
    ? undefined
    : { entries, manifestBytes, signature, manifest };
}

export function gateBundle(
  context: BundleContext,
  entry: ToolIndexEntry,
  problems: Problems,
): void {
  const opened = openBundle(context.dir, entry, problems);
  if (opened === undefined) return;
  const { asset } = entry;
  const keyId = opened.manifest.signature?.keyId ?? '';
  const label = `${asset}: ${MANIFEST_SIG_FILE}`;
  verifySigned(
    { label, bytes: opened.manifestBytes, signature: opened.signature, keyId },
    context.keys,
    problems,
  );
  if (context.release) checkNotTestKey(label, keyId, problems);
  checkFiles(asset, opened, problems);
  checkRuntime(asset, opened, problems);
  checkHostFit(asset, opened.manifest, context.index, problems);
  checkListing(entry, opened, problems);
}
