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

// Only expo-router's unused native tabs import these; they bundle 6.5 MB of fonts.
const blockedModules = new Set([
  'expo-symbols',
  '@expo-google-fonts/material-symbols',
]);
const baseResolveRequest = config.resolver.resolveRequest;
const blockingResolveRequest = (context, moduleName, platform) => {
  if (blockedModules.has(moduleName)) {
    return { type: 'empty' };
  }
  return baseResolveRequest
    ? baseResolveRequest(context, moduleName, platform)
    : context.resolveRequest(context, moduleName, platform);
};
config.resolver.resolveRequest = blockingResolveRequest;

const nativewindConfig = withNativewind(config);
const classNameResolveRequest = nativewindConfig.resolver.resolveRequest;
const expoAssetDir = `${path.sep}node_modules${path.sep}expo-asset${path.sep}`;
// react-native-css 3.1.0-rc.1 swaps 'react-native' for a shim that lacks RN 0.88's
// AssetRegistry, which expo-asset imports to load every font and image asset.
nativewindConfig.resolver.resolveRequest = (context, moduleName, platform) =>
  moduleName === 'react-native' &&
  context.originModulePath.includes(expoAssetDir)
    ? blockingResolveRequest(context, moduleName, platform)
    : classNameResolveRequest(context, moduleName, platform);

module.exports = nativewindConfig;
