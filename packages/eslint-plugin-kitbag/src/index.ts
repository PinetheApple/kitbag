import type { Linter } from 'eslint';

import { kitbagPlugin, meta, rules } from './plugin.ts';

const recommended: Linter.Config[] = [
  {
    plugins: { kitbag: kitbagPlugin },
    rules: {
      'kitbag/native-only-in-core-native': 'error',
      'kitbag/zustand-create-only-in-core-state': 'error',
      'kitbag/plugin-api-imports-nothing': 'error',
      'kitbag/filename-naming-convention': 'error',
    },
  },
];

const plugin = { meta, rules, configs: { recommended } };

export { boundariesElements, boundariesElementTypes } from './boundaries.ts';
export {
  downloadablePackages,
  downloadableZoneConfig,
  type ZoneBase,
} from './downloadableZone.ts';

export default plugin;
