import { createHash, createPublicKey, verify } from 'node:crypto';

const CURVE = 'prime256v1';
const DIGEST = 'sha256';

export function verifyEs256(
  data: Buffer,
  signature: Buffer,
  spkiBase64: string,
): boolean {
  try {
    const key = createPublicKey({
      key: Buffer.from(spkiBase64, 'base64'),
      format: 'der',
      type: 'spki',
    });
    if (key.asymmetricKeyDetails?.namedCurve !== CURVE) return false;
    return verify(DIGEST, data, { key, dsaEncoding: 'der' }, signature);
  } catch {
    return false;
  }
}

export function sha256(bytes: Buffer): string {
  return createHash(DIGEST).update(bytes).digest('hex');
}
