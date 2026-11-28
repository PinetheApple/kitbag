import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';

import { HOST_API } from '../toolHost/hostApi.ts';
import { gateBundle } from './gateBundle.ts';
import {
  checkNotTestKey,
  checkReleasePins,
  readKeys,
  verifySigned,
} from './gateKeys.ts';
import {
  INDEX_FILE,
  INDEX_SIG_FILE,
  isJsonObject,
  SCHEMA_VERSION,
  signatureProblem,
  type ToolIndex,
} from './manifest.ts';
import { Problems } from './problems.ts';
import { kbtFiles, type HostRelease } from './toolSet.ts';

export interface GateRequest {
  readonly dir: string;
  readonly keysFile: string;
  readonly host: HostRelease;
  readonly release: boolean;
}

function checkIndex(
  raw: unknown,
  request: GateRequest,
  problems: Problems,
): ToolIndex | undefined {
  const ok = problems.check(
    isJsonObject(raw) &&
      raw.schema === SCHEMA_VERSION &&
      Array.isArray(raw.tools) &&
      isJsonObject(raw.host),
    `${INDEX_FILE} is not a schema ${String(SCHEMA_VERSION)} index`,
  );
  if (!ok) return undefined;
  const index = raw as ToolIndex;
  const signatureIssue = signatureProblem(index.signature);
  if (signatureIssue !== undefined) {
    problems.add(`${INDEX_FILE}: ${signatureIssue}`);
    return undefined;
  }
  const { host } = request;
  problems.check(
    index.host.versionName === host.versionName &&
      index.host.versionCode === host.versionCode,
    `${INDEX_FILE} is for host ${index.host.versionName} (${String(index.host.versionCode)}), not ${host.versionName} (${String(host.versionCode)})`,
  );
  problems.check(
    index.hostApi.major === HOST_API.major &&
      index.hostApi.minor === HOST_API.minor,
    `${INDEX_FILE} hostApi is not this host's ${String(HOST_API.major)}.${String(HOST_API.minor)}`,
  );
  const ids = index.tools.map((tool) => tool.id);
  problems.check(
    new Set(ids).size === ids.length,
    `${INDEX_FILE} lists a tool id twice`,
  );
  return index;
}

function checkStrayKbts(
  dir: string,
  index: ToolIndex,
  problems: Problems,
): void {
  const listed = new Set(index.tools.map((tool) => tool.asset));
  for (const asset of kbtFiles(dir))
    problems.check(listed.has(asset), `${asset} is not in ${INDEX_FILE}`);
}

export function gateToolSet(request: GateRequest): string[] {
  const problems = new Problems();
  const keys = readKeys(request.keysFile, problems);
  if (request.release) checkReleasePins(keys, problems);
  const indexPath = path.join(request.dir, INDEX_FILE);
  const sigPath = path.join(request.dir, INDEX_SIG_FILE);
  if (!existsSync(indexPath) || !existsSync(sigPath)) {
    problems.add(`no ${INDEX_FILE} and ${INDEX_SIG_FILE} in ${request.dir}`);
    return problems.list;
  }
  const bytes = readFileSync(indexPath);
  const index = checkIndex(
    JSON.parse(bytes.toString('utf8')),
    request,
    problems,
  );
  if (index === undefined) return problems.list;
  const { keyId } = index.signature;
  verifySigned(
    { label: INDEX_FILE, bytes, signature: readFileSync(sigPath), keyId },
    keys,
    problems,
  );
  if (request.release) checkNotTestKey(INDEX_FILE, keyId, problems);
  checkStrayKbts(request.dir, index, problems);
  const context = { dir: request.dir, index, keys, release: request.release };
  for (const entry of index.tools) gateBundle(context, entry, problems);
  return problems.list;
}
