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

// #49: expo-router's native-tabs helper (unused — the app has no bottom nav)
// imports expo-symbols, whose SymbolView loads every weight of
// @expo-google-fonts/material-symbols through useFonts. Metro then ships all
// seven ~1 MB ttf files as res/raw entries in the APK. Blocking both at
// resolution removes 6.5 MB; nothing else in the graph references them.
const blockedModules = new Set(['expo-symbols', '@expo-google-fonts/material-symbols']);
const baseResolveRequest = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (blockedModules.has(moduleName)) {
    return { type: 'empty' };
  }
  return baseResolveRequest
    ? baseResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativewind(config);
