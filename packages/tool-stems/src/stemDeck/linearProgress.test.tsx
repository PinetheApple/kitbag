import { asPercent, LinearProgress } from '@kitbag/core-design';
import { describe, expect, it, vi } from 'vitest';

import { AccessibilityInfo } from '@kitbag/core-state/src/testing/reactNativeHosts.ts';
import { mount } from './stemDeckHarness.test-helper.tsx';

const RESTING_START = asPercent(0.28);

vi.spyOn(AccessibilityInfo, 'isReduceMotionEnabled').mockResolvedValue(true);

describe('progress with no percentage under reduce motion', () => {
  it('holds a still band instead of sweeping', async () => {
    const screen = await mount(
      <LinearProgress percent={null} accessibilityLabel="Preparing" />,
    );
    await screen.settle();
    const hosts = screen.hosts();
    expect(hosts.some((node) => String(node.type) === 'Animated.View')).toBe(
      false,
    );
    expect(
      hosts.some((node) =>
        [node.props.style]
          .flat(Infinity)
          .some(
            (part: { marginLeft?: unknown } | null) =>
              part?.marginLeft === RESTING_START,
          ),
      ),
    ).toBe(true);
  });
});
