const ID = '[a-z][a-z0-9-]{1,31}';
const ASSET_SEGMENT = '[A-Za-z0-9_-][A-Za-z0-9._-]*';
const ROUTE_SEGMENT = '[A-Za-z0-9\\[\\]._-]+';

export const BUNDLE_RULES = {
  schemaVersion: 1,
  signatureAlg: 'ES256',
  files: {
    manifest: 'manifest.json',
    manifestSig: 'manifest.sig',
    entry: 'bundle.hbc',
    assetsDir: 'assets',
    index: 'tools-index.json',
    indexSig: 'tools-index.json.sig',
    kbtExtension: '.kbt',
  },
  patterns: {
    id: `^${ID}$`,
    keyId: `^${ID}$`,
    semver: '^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)$',
    sha256: '^[0-9a-f]{64}$',
    filePath: `^(bundle\\.hbc|assets(/${ASSET_SEGMENT})+)$`,
    route: `^/t/${ID}(/${ROUTE_SEGMENT})*$`,
  },
  limits: { nameMax: 40, summaryMax: 80, changelogMax: 500, labelMax: 40 },
  keys: {
    testPrefix: 'test-',
    roles: ['tools', 'revocation'],
    statuses: ['current', 'next', 'retired'],
    signingStatuses: ['current', 'next'],
    spkiBytes: 91,
  },
} as const;
