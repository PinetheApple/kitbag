import { Icon } from '@kitbag/core-design';
import type { ToolHost, ToolPlugin } from '@kitbag/core-plugin-api';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { Gesture } from 'react-native-gesture-handler';
import { useFrameCallback, useSharedValue } from 'react-native-reanimated';
import { Path } from 'react-native-svg';
import { scheduleOnRN } from 'react-native-worklets';

export const allowlisted = [
  Icon,
  useState,
  StyleSheet,
  View,
  Gesture,
  useFrameCallback,
  useSharedValue,
  Path,
  scheduleOnRN,
];

export function register(host: ToolHost): ToolPlugin {
  host.store.createToolStore({ reps: 0 });
  return { id: 'drill', name: 'Drill', icon: 'drill', routes: [] };
}
