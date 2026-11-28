import { TOOL_ID as ID } from '@kitbag/core-plugin-api';

import { HOST_API } from '../toolHost/hostApi.ts';

const ASSET_SEGMENT = '[A-Za-z0-9_-][A-Za-z0-9._-]*';
const ROUTE_SEGMENT = '[A-Za-z0-9\\[\\]._-]+';
const ROUTE_PREFIX = '/t/';
const TOOL_ROLE = 'tools';
const REVOCATION_ROLE = 'revocation';
const STATUS = {
  current: 'current',
  next: 'next',
  retired: 'retired',
} as const;
const MIB = 1_048_576;
const MAX_INFLATED_MIB = 64;
const RELEASE_HOST = 'github.com';
const RELEASE_REPO = 'PinetheApple/kitbag';

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
    keyPins: 'tool-keys.json',
  },
  patterns: {
    id: `^${ID}$`,
    keyId: `^${ID}$`,
    semver: '^(0|[1-9]\\d*)\\.(0|[1-9]\\d*)\\.(0|[1-9]\\d*)$',
    sha256: '^[0-9a-f]{64}$',
    filePath: `^(bundle\\.hbc|assets(/${ASSET_SEGMENT})+)$`,
    route: `^${ROUTE_PREFIX}${ID}(/${ROUTE_SEGMENT})*$`,
  },
  routePrefix: ROUTE_PREFIX,
  hostApi: HOST_API,
  release: {
    host: RELEASE_HOST,
    repo: RELEASE_REPO,
    downloadPath: 'releases/download',
    tagPrefix: 'v',
  },
  hbc: {
    magic: 'c61fbc03c103191f',
    versionBytes: 4,
  },
  runtimeFields: {
    bytecodeVersion: 'hermesBytecodeVersion',
    packages: {
      reactNative: 'react-native',
      react: 'react',
      reanimated: 'react-native-reanimated',
      worklets: 'react-native-worklets',
    },
  },
  pinFields: {
    schema: 'schema',
    keys: 'keys',
    keyId: 'keyId',
    role: 'role',
    status: 'status',
    spki: 'spkiBase64',
  },
  manifestFields: [
    'schema',
    'id',
    'name',
    'version',
    'icon',
    'summary',
    'hostApi',
    'host',
    'runtime',
    'entry',
    'files',
    'size',
    'routes',
    'homeTile',
    'capabilities',
    'requires',
    'changelog',
    'signature',
  ],
  limits: {
    nameMax: 40,
    summaryMax: 80,
    changelogMax: 500,
    labelMax: 40,
    inflatedMaxBytes: MAX_INFLATED_MIB * MIB,
  },
  keys: {
    testPrefix: 'test-',
    toolRole: TOOL_ROLE,
    revocationRole: REVOCATION_ROLE,
    roles: [TOOL_ROLE, REVOCATION_ROLE],
    status: STATUS,
    statuses: [STATUS.current, STATUS.next, STATUS.retired],
    signingStatuses: [STATUS.current, STATUS.next],
    spkiBytes: 91,
  },
} as const;
