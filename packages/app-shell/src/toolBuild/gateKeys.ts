import { readFileSync } from 'node:fs';

import { BUNDLE_RULES } from './bundleRules.ts';
import {
  isJsonObject,
  KEY_ID,
  SCHEMA_VERSION,
  TEST_KEY_PREFIX,
  type PinnedKey,
} from './manifest.ts';
import { BuildError } from './paths.ts';
import { Problems } from './problems.ts';
import { isP256Spki, verifyEs256 } from './signature.ts';

export interface Signed {
  readonly label: string;
  readonly bytes: Buffer;
  readonly signature: Buffer;
  readonly keyId: string;
}

const { roles, statuses, signingStatuses } = BUNDLE_RULES.keys;

function isOneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
): value is T {
  return allowed.includes(value as T);
}

function pinProblems(pin: unknown, seen: Set<string>): string[] {
  const problems = new Problems();
  if (
    !problems.check(
      isJsonObject(pin) && typeof pin.keyId === 'string',
      `pin ${JSON.stringify(pin)} has no keyId`,
    )
  ) {
    return problems.list;
  }
  const { keyId, role, status, spkiBase64 } = pin as Record<string, unknown>;
  const label = `pin ${String(keyId)}`;
  problems.check(KEY_ID.test(String(keyId)), `${label}: keyId is not a key id`);
  problems.check(!seen.has(String(keyId)), `${label}: keyId is pinned twice`);
  seen.add(String(keyId));
  problems.check(
    isOneOf(role, roles),
    `${label}: role must be one of ${roles.join(', ')}`,
  );
  if (role === 'tools') {
    problems.check(
      isOneOf(status, statuses),
      `${label}: a tool key needs a status of ${statuses.join(', ')}`,
    );
  } else {
    problems.check(
      status === undefined,
      `${label}: only a tool key has a status`,
    );
  }
  problems.check(
    typeof spkiBase64 === 'string' && isP256Spki(spkiBase64),
    `${label}: spkiBase64 is not a P-256 SubjectPublicKeyInfo`,
  );
  return problems.list;
}

export function readKeys(keysFile: string, problems: Problems): PinnedKey[] {
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
  const seen = new Set<string>();
  return (pins.keys as unknown[]).filter((pin): pin is PinnedKey => {
    const found = pinProblems(pin, seen);
    for (const problem of found) problems.add(problem);
    return found.length === 0;
  });
}

export function verifySigned(
  signed: Signed,
  keys: readonly PinnedKey[],
  problems: Problems,
): void {
  const { label, keyId } = signed;
  const key = keys.find(
    (k) =>
      k.keyId === keyId &&
      k.role === 'tools' &&
      isOneOf(k.status, signingStatuses),
  );
  if (key === undefined) {
    problems.add(
      `${label} is signed by ${keyId}, which is not a pinned current or next tool key`,
    );
    return;
  }
  if (!verifyEs256(signed.bytes, signed.signature, key.spkiBase64)) {
    problems.add(`${label} does not verify with ${keyId}`);
  }
}

export function checkNotTestKey(
  label: string,
  keyId: string,
  problems: Problems,
): void {
  problems.check(
    !keyId.startsWith(TEST_KEY_PREFIX),
    `${label} is signed by ${keyId}; a release is signed by no ${TEST_KEY_PREFIX} key`,
  );
}

export function checkReleasePins(
  keys: readonly PinnedKey[],
  problems: Problems,
): void {
  for (const key of keys) {
    problems.check(
      !key.keyId.startsWith(TEST_KEY_PREFIX),
      `the pin file holds ${key.keyId}; a release pins no ${TEST_KEY_PREFIX} key`,
    );
  }
}
