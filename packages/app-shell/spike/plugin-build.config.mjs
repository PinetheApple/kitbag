import { execFileSync } from 'node:child_process';
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { SPIKE_EXTERNALS } from '../src/spike/registry.ts';

const spikeDir = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(spikeDir, '..');
const monorepoRoot = path.resolve(projectRoot, '../..');
const shimDir = path.join(spikeDir, '.externals');
const rawDir = path.join(projectRoot, 'android/app/src/main/res/raw');
const jsOut = path.join(rawDir, 'kb_spike_plugin_js.js');
const hbcOut = path.join(rawDir, 'kb_spike_plugin_hbc.hbc');
const require = createRequire(path.join(projectRoot, 'package.json'));

function writeShims() {
  rmSync(shimDir, { recursive: true, force: true });
  mkdirSync(shimDir, { recursive: true });
  return new Map(
    SPIKE_EXTERNALS.map((name) => {
      const file = path.join(shimDir, `${name.replaceAll('/', '__')}.js`);
      writeFileSync(
        file,
        `module.exports = require('../../src/spike/registry').hostModule(${JSON.stringify(name)});\n`,
      );
      return [name, file];
    }),
  );
}

function pluginConfig(shims) {
  const { getDefaultConfig } = require('expo/metro-config');
  const config = getDefaultConfig(projectRoot);
  config.watchFolders = [monorepoRoot];
  config.resolver.nodeModulesPaths = [
    path.join(projectRoot, 'node_modules'),
    path.join(monorepoRoot, 'node_modules'),
  ];
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    const shim = shims.get(moduleName);
    return shim === undefined
      ? context.resolveRequest(context, moduleName, platform)
      : { type: 'sourceFile', filePath: shim };
  };
  config.serializer.getModulesRunBeforeMainModule = () => [];
  config.serializer.getPolyfills = () => [];
  config.transformer.globalPrefix = '__kbspike';
  return config;
}

function hermesc() {
  const compilerPkg = require.resolve('hermes-compiler/package.json', {
    paths: [path.dirname(require.resolve('react-native/package.json'))],
  });
  return path.join(path.dirname(compilerPkg), 'hermesc/linux64-bin/hermesc');
}

const shims = writeShims();
mkdirSync(rawDir, { recursive: true });
const Metro = require('metro');
await Metro.runBuild(pluginConfig(shims), {
  entry: path.join(spikeDir, 'plugin-entry.tsx'),
  platform: 'android',
  dev: false,
  minify: true,
  out: jsOut,
  customTransformOptions: { engine: 'hermes' },
});
execFileSync(hermesc(), ['-emit-binary', '-O', '-out', hbcOut, jsOut], {
  stdio: 'inherit',
});
console.log(`wrote ${jsOut}\nwrote ${hbcOut}`);
