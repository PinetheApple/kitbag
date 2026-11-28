import type { TurboModule } from 'react-native';
import { TurboModuleRegistry } from 'react-native';

export interface Spec extends TurboModule {
  verifyInstalled(toolId: string): Promise<void>;
}

export function getKitbagTools(): Spec {
  return TurboModuleRegistry.getEnforcing<Spec>('KitbagTools');
}
