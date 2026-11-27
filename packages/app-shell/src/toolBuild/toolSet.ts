import { readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';

import { HOST_API } from '../toolHost/hostApi.ts';
import {
  INDEX_FILE,
  KBT_EXTENSION,
  MANIFEST_FILE,
  MANIFEST_SIG_FILE,
  SCHEMA_VERSION,
  SIGNATURE_ALG,
  type ToolIndex,
  type ToolIndexEntry,
  type ToolManifest,
} from './manifest.ts';
import { BuildError } from './paths.ts';
import { sha256 } from './signature.ts';
import { readZip, writeZip, type ZipEntry } from './zip.ts';

export interface HostRelease {
  readonly versionName: string;
  readonly versionCode: number;
}

const STAMPED_SUFFIX = '.manifest.json';
const SIG_SUFFIX = '.manifest.sig';

export function kbtFiles(dir: string): string[] {
  const files = readdirSync(dir)
    .filter((name) => name.endsWith(KBT_EXTENSION))
    .sort();
  if (files.length === 0)
    throw new BuildError(`no *${KBT_EXTENSION} in ${dir}`);
  return files;
}

function zipEntry(entries: readonly ZipEntry[], name: string): Buffer {
  const found = entries.find((entry) => entry.name === name);
  if (found === undefined) throw new BuildError(`${name} is missing`);
  return found.data;
}

function parseManifest(bytes: Buffer): ToolManifest {
  return JSON.parse(bytes.toString('utf8')) as ToolManifest;
}

export function stampManifests(
  dir: string,
  keyId: string,
  workDir: string,
): void {
  for (const asset of kbtFiles(dir)) {
    const manifest = parseManifest(
      zipEntry(readZip(readFileSync(path.join(dir, asset))), MANIFEST_FILE),
    );
    const stamped = { ...manifest, signature: { alg: SIGNATURE_ALG, keyId } };
    writeFileSync(
      path.join(workDir, `${asset}${STAMPED_SUFFIX}`),
      `${JSON.stringify(stamped, null, 2)}\n`,
    );
  }
}

export function sealBundles(dir: string, workDir: string): void {
  for (const asset of kbtFiles(dir)) {
    const kbt = path.join(dir, asset);
    const signed = new Set([MANIFEST_FILE, MANIFEST_SIG_FILE]);
    const payload = readZip(readFileSync(kbt)).filter(
      (entry) => !signed.has(entry.name),
    );
    const manifest = readFileSync(
      path.join(workDir, `${asset}${STAMPED_SUFFIX}`),
    );
    const signature = readFileSync(path.join(workDir, `${asset}${SIG_SUFFIX}`));
    writeFileSync(
      kbt,
      writeZip([
        { name: MANIFEST_FILE, data: manifest },
        { name: MANIFEST_SIG_FILE, data: signature },
        ...payload,
      ]),
    );
  }
}

function indexEntry(asset: string, kbt: Buffer): ToolIndexEntry {
  const manifestBytes = zipEntry(readZip(kbt), MANIFEST_FILE);
  const m = parseManifest(manifestBytes);
  return {
    id: m.id,
    version: m.version,
    name: m.name,
    icon: m.icon,
    ...(m.summary === undefined ? {} : { summary: m.summary }),
    asset,
    size: kbt.length,
    kbtSha256: sha256(kbt),
    manifestSha256: sha256(manifestBytes),
    capabilities: m.capabilities,
    ...(m.changelog === undefined ? {} : { changelog: m.changelog }),
  };
}

export function writeIndex(
  dir: string,
  keyId: string,
  host: HostRelease,
): void {
  const index: ToolIndex = {
    schema: SCHEMA_VERSION,
    host,
    hostApi: HOST_API,
    signature: { alg: SIGNATURE_ALG, keyId },
    tools: kbtFiles(dir).map((asset) =>
      indexEntry(asset, readFileSync(path.join(dir, asset))),
    ),
  };
  writeFileSync(
    path.join(dir, INDEX_FILE),
    `${JSON.stringify(index, null, 2)}\n`,
  );
}
