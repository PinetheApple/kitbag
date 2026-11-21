import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';

interface Resolution {
  readonly type: string;
  readonly filePath?: string;
}
interface ResolutionContext {
  readonly originModulePath: string;
  readonly resolveRequest: ResolveRequest;
}
type ResolveRequest = (
  context: ResolutionContext,
  moduleName: string,
  platform: string,
) => Resolution;
interface MetroConfig {
  readonly resolver: { readonly resolveRequest: ResolveRequest };
}

const APP = join(import.meta.dirname, '..');
const requireFromApp = createRequire(join(APP, 'package.json'));
const REACT_NATIVE = 'react-native';
const PLATFORM = 'android';
const GETTERS_MISSING_FROM_STAND_IN = ['AssetRegistry'];
const GETTER = /^\s*get (\w+)\(\)/gm;

const reactNativeIndex = requireFromApp.resolve(REACT_NATIVE);
const standInIndex = requireFromApp.resolve('react-native-css/components');
const expoAssetDir = dirname(requireFromApp.resolve('expo-asset/package.json'));

function getterNames(file: string): Set<string> {
  return new Set(
    Array.from(readFileSync(file, 'utf8').matchAll(GETTER)).flatMap(
      ([, name]) => (name ? [name] : []),
    ),
  );
}

function nodeResolve(
  context: ResolutionContext,
  moduleName: string,
): Resolution {
  return {
    type: 'sourceFile',
    filePath: requireFromApp.resolve(moduleName, {
      paths: [dirname(context.originModulePath)],
    }),
  };
}

function resolveReactNativeFrom(originModulePath: string): string | undefined {
  const config = requireFromApp('./metro.config.js') as MetroConfig;
  const context = { originModulePath, resolveRequest: nodeResolve };
  return config.resolver.resolveRequest(context, REACT_NATIVE, PLATFORM)
    .filePath;
}

describe('react-native-css stand-in for react-native', () => {
  it('lacks only the AssetRegistry export of react-native', () => {
    const standIn = getterNames(standInIndex);
    const missing = [...getterNames(reactNativeIndex)].filter(
      (name) => !standIn.has(name),
    );

    expect(missing).toEqual(GETTERS_MISSING_FROM_STAND_IN);
  });
});

describe('metro resolver', () => {
  it('gives expo-asset the real react-native', () => {
    const origin = join(expoAssetDir, 'build', 'AssetSources.js');

    expect(resolveReactNativeFrom(origin)).toBe(reactNativeIndex);
  });

  it('gives app code the react-native-css stand-in', () => {
    const origin = join(APP, 'src', 'appBar.ts');

    expect(resolveReactNativeFrom(origin)).toBe(standInIndex);
  });
});
