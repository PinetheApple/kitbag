import { evaluateBundle } from '@kitbag/core-native';
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

const ASSET_JS = 'kb_spike_plugin.js';
const ASSET_BYTECODE = 'kb_spike_plugin.hbc';

export function shippedSpikeLocation(bytecode: boolean): string {
  return bytecode ? ASSET_BYTECODE : ASSET_JS;
}

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

export function loadSpikeScreen(
  location: string,
): ComponentType<SpikeScreenProps> {
  installSpikeRegistry(HOST_MODULES);
  const startedMs = performance.now();
  const before = globalDescriptors();
  evaluateBundle(location);
  const touched = restoreGlobals(before);
  console.log(
    `KB_SPIKE loaded location=${location} evalMs=${(performance.now() - startedMs).toFixed(1)} restored=${touched.join(',')}`,
  );
  const screen = spikeRegistry().screen;
  if (screen === undefined) throw new Error('bundle registered no screen');
  return screen;
}
