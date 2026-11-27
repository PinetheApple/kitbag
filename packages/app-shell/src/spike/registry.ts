import type { ComponentType } from 'react';

import type { SpikeScreenProps } from './SpikeScreen';

export const SPIKE_EXTERNALS = [
  'react',
  'react/jsx-runtime',
  'react-native',
  'react-native-reanimated',
  'react-native-worklets',
] as const;

export type SpikeExternal = (typeof SPIKE_EXTERNALS)[number];

export const SPIKE_REGISTRY_KEY = '__kitbagSpike';

export interface SpikeRegistry {
  readonly modules: Readonly<Record<SpikeExternal, unknown>>;
  screen?: ComponentType<SpikeScreenProps>;
}

interface RegistryGlobal {
  [SPIKE_REGISTRY_KEY]?: SpikeRegistry;
}

export function installSpikeRegistry(
  modules: Readonly<Record<SpikeExternal, unknown>>,
): void {
  (globalThis as RegistryGlobal)[SPIKE_REGISTRY_KEY] = { modules };
}

export function spikeRegistry(): SpikeRegistry {
  const registry = (globalThis as RegistryGlobal)[SPIKE_REGISTRY_KEY];
  if (registry === undefined) {
    throw new Error(`${SPIKE_REGISTRY_KEY} is not installed by the host`);
  }
  return registry;
}

export function hostModule(name: SpikeExternal): unknown {
  const exported = spikeRegistry().modules[name];
  if (exported === undefined) {
    throw new Error(`host does not provide ${name}`);
  }
  return exported;
}

export function registerSpikeScreen(
  screen: ComponentType<SpikeScreenProps>,
): void {
  spikeRegistry().screen = screen;
}
