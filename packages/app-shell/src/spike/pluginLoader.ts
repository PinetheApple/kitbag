import { evaluateBundleBytes } from '@kitbag/core-native';
import Constants from 'expo-constants';
import type { ComponentType } from 'react';
import * as React from 'react';
import * as JsxRuntime from 'react/jsx-runtime';
import { StyleSheet, Text, View } from 'react-native';
import * as Reanimated from 'react-native-reanimated';
import * as Worklets from 'react-native-worklets';

import {
  installSpikeRegistry,
  SPIKE_REGISTRY_KEY,
  spikeRegistry,
  type SpikeExternal,
} from './registry';
import type { SpikeScreenProps } from './SpikeScreen';

const HOST_MODULES: Readonly<Record<SpikeExternal, unknown>> = {
  react: React,
  'react/jsx-runtime': JsxRuntime,
  'react-native': { StyleSheet, Text, View },
  'react-native-reanimated': Reanimated,
  'react-native-worklets': Worklets,
};

const RAW_JS = 'kb_spike_plugin_js';
const RAW_BYTECODE = 'kb_spike_plugin_hbc';

export interface SpikeSource {
  readonly uri: string;
  readonly bytecode: boolean;
}

export function shippedSpikeSource(bytecode: boolean): SpikeSource {
  const pkg = Constants.expoConfig?.android?.package;
  if (pkg === undefined)
    throw new Error('android package is not in the manifest');
  return {
    uri: `android.resource://${pkg}/raw/${bytecode ? RAW_BYTECODE : RAW_JS}`,
    bytecode,
  };
}

const globalEval = (
  globalThis as unknown as { eval: (source: string) => unknown }
).eval;

type Descriptors = ReadonlyMap<string, PropertyDescriptor | undefined>;

function globalDescriptors(): Descriptors {
  return new Map(
    Object.getOwnPropertyNames(globalThis).map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ]),
  );
}

function restoreGlobals(before: Descriptors): string[] {
  const target = globalThis as Record<string, unknown>;
  const touched: string[] = [];
  for (const key of Object.getOwnPropertyNames(globalThis)) {
    if (key === SPIKE_REGISTRY_KEY) continue;
    const previous = before.get(key);
    if (previous === undefined) {
      touched.push(`+${key}:${String(Reflect.deleteProperty(target, key))}`);
    } else if (
      'value' in previous &&
      Object.getOwnPropertyDescriptor(globalThis, key)?.value !== previous.value
    ) {
      target[key] = previous.value;
      touched.push(`~${key}`);
    }
  }
  return touched;
}

export async function loadSpikeScreen(
  source: SpikeSource,
): Promise<ComponentType<SpikeScreenProps>> {
  installSpikeRegistry(HOST_MODULES);
  const response = await fetch(source.uri);
  const payload = source.bytecode
    ? await response.arrayBuffer()
    : await response.text();
  const startedMs = performance.now();
  const before = globalDescriptors();
  if (typeof payload === 'string') globalEval(payload);
  else evaluateBundleBytes(payload, source.uri);
  const touched = restoreGlobals(before);
  console.log(
    `KB_SPIKE loaded uri=${source.uri} bytecode=${String(source.bytecode)} evalMs=${(performance.now() - startedMs).toFixed(1)} restored=${touched.join(',')}`,
  );
  const screen = spikeRegistry().screen;
  if (screen === undefined) throw new Error('bundle registered no screen');
  return screen;
}
