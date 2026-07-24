// Metro config for the app-shell inside a pnpm monorepo (SPEC §13.1).
// Watches the workspace root and resolves from both node_modules trees so the
// @kitbag/* workspace packages resolve under the hoisted linker.
// NOTE (#27): not exercised this task — bundling/device boot is #33.
const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');
const { withNativewind } = require('nativewind/metro');

const projectRoot = __dirname;
const monorepoRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [monorepoRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(monorepoRoot, 'node_modules'),
];

module.exports = withNativewind(config);
