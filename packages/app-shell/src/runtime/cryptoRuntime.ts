import { randomUUID } from 'expo-crypto';

// Hermes has no Web Crypto, and every new row's uuid comes from
// crypto.randomUUID (#141). Imported first so no store writes before it lands.
const host = globalThis as { crypto?: Partial<Crypto> };
if (typeof host.crypto?.randomUUID !== 'function') {
  host.crypto = Object.assign(host.crypto ?? {}, { randomUUID });
}
