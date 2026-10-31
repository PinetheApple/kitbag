import { createRigClick, type RigClickStore } from '@kitbag/core-state';
import { useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { AppState } from 'react-native';

import { attachRigClick } from './rigClickLifecycle.ts';
import { rigClickDeps } from './rigRuntime';

export function useRigClickSession(): RigClickStore {
  const [click] = useState(() => createRigClick(rigClickDeps));
  useFocusEffect(
    useCallback(() => attachRigClick(click.getState(), AppState), [click]),
  );
  return click;
}
