import {
  createHash,
  createPublicKey,
  verify,
  type KeyObject,
} from 'node:crypto';

import { BUNDLE_RULES } from './bundleRules.ts';

const CURVE = 'prime256v1';
const DIGEST = 'sha256';

function p256Key(spkiBase64: string): KeyObject | undefined {
  const der = Buffer.from(spkiBase64, 'base64');
  if (der.length !== BUNDLE_RULES.keys.spkiBytes) return undefined;
  try {
    const key = createPublicKey({ key: der, format: 'der', type: 'spki' });
    return key.asymmetricKeyDetails?.namedCurve === CURVE ? key : undefined;
  } catch {
    return undefined;
  }
}

export function isP256Spki(spkiBase64: string): boolean {
  return p256Key(spkiBase64) !== undefined;
}

export function verifyEs256(
  data: Buffer,
  signature: Buffer,
  spkiBase64: string,
): boolean {
  const key = p256Key(spkiBase64);
  if (key === undefined) return false;
  try {
    return verify(DIGEST, data, { key, dsaEncoding: 'der' }, signature);
  } catch {
    return false;
  }
}

export function sha256(bytes: Buffer): string {
  return createHash(DIGEST).update(bytes).digest('hex');
}
