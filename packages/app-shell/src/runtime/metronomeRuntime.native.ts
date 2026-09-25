import { getKitbagCommands, getKitbagHostObject } from '@kitbag/core-native';
import { configureMetronomeRuntime } from '@kitbag/core-state';

configureMetronomeRuntime({
  commands: getKitbagCommands(),
  nowFrame: () => getKitbagHostObject().frames_rendered,
});
