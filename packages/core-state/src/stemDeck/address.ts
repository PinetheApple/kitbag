export type AddressProblem = 'empty' | 'incomplete' | 'unsupported' | 'invalid';

export type ParsedAddress =
  | {
      readonly ok: true;
      readonly origin: string;
      readonly secure: boolean;
    }
  | { readonly ok: false; readonly problem: AddressProblem };

const HTTPS = 'https';
const HTTP = 'http';
const DEFAULT_PORT: Readonly<Record<string, number>> = { https: 443, http: 80 };
const MAX_PORT = 65535;
const IPV4_PARTS = 4;
const MAX_OCTET = 255;
const FINGERPRINT_SHOWN_CHARS = 16;
const FINGERPRINT_GROUP_CHARS = 4;

const SCHEME = /^([a-z][a-z0-9+.-]*):\/\//i;
const AUTHORITY = /^(\[[0-9a-f:.]+\]|[^:/[\]]+)(?::(\d*))?\/?$/i;
const NUMERIC_HOST = /^[\d.]+$/;
const HOST_NAME = /^[a-z0-9-]+(\.[a-z0-9-]+)*$/i;

function problem(reason: AddressProblem): ParsedAddress {
  return { ok: false, problem: reason };
}

function hostProblem(host: string): AddressProblem | null {
  if (host.startsWith('[')) return null;
  if (!NUMERIC_HOST.test(host)) return HOST_NAME.test(host) ? null : 'invalid';
  const parts = host.split('.');
  if (parts.length < IPV4_PARTS || parts.includes('')) return 'incomplete';
  if (parts.length > IPV4_PARTS) return 'invalid';
  return parts.every((part) => Number(part) <= MAX_OCTET) ? null : 'invalid';
}

function portOf(raw: string | undefined, scheme: string): number | null {
  if (raw === undefined) return DEFAULT_PORT[scheme] ?? null;
  const port = Number(raw);
  return raw !== '' && Number.isInteger(port) && port > 0 && port <= MAX_PORT
    ? port
    : null;
}

// A bare address means https: that is what StemDeck's QR code shows.
export function parseAddress(text: string): ParsedAddress {
  const trimmed = text.trim();
  if (trimmed === '') return problem('empty');
  const scheme = SCHEME.exec(trimmed)?.[1]?.toLowerCase();
  if (scheme !== undefined && scheme !== HTTPS && scheme !== HTTP)
    return problem('unsupported');
  const effective = scheme ?? HTTPS;
  const rest = scheme === undefined ? trimmed : trimmed.replace(SCHEME, '');
  const match = AUTHORITY.exec(rest);
  const host = match?.[1]?.toLowerCase();
  if (match === null || host === undefined) return problem('invalid');
  const hostIssue = hostProblem(host);
  if (hostIssue !== null) return problem(hostIssue);
  if (match[2] === '') return problem('incomplete');
  const port = portOf(match[2], effective);
  if (port === null) return problem('invalid');
  return {
    ok: true,
    origin: `${effective}://${host}:${String(port)}`,
    secure: effective === HTTPS,
  };
}

export function displayAddress(origin: string): string {
  const prefix = `${HTTPS}://`;
  return origin.startsWith(prefix) ? origin.slice(prefix.length) : origin;
}

export function shortFingerprint(fingerprint: string): string {
  const shown = fingerprint.slice(0, FINGERPRINT_SHOWN_CHARS).toUpperCase();
  const groups: string[] = [];
  for (let at = 0; at < shown.length; at += FINGERPRINT_GROUP_CHARS)
    groups.push(shown.slice(at, at + FINGERPRINT_GROUP_CHARS));
  return groups.join(' ');
}
