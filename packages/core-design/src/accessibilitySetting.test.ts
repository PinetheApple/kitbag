import { describe, expect, it, vi } from 'vitest';

import {
  readoutSetting,
  type AccessibilitySource,
} from './accessibilitySetting.ts';

function fakeAccessibilityInfo(reader: boolean, service: boolean) {
  const events: string[] = [];
  const info: AccessibilitySource = {
    isScreenReaderEnabled: () => Promise.resolve(reader),
    isAccessibilityServiceEnabled: () => Promise.resolve(service),
    addEventListener: (event) => {
      events.push(event);
      return { remove: vi.fn() };
    },
  };
  return { info, events };
}

describe('readoutSetting', () => {
  it('counts any Android accessibility service, Switch Access included', async () => {
    const { info, events } = fakeAccessibilityInfo(false, true);
    const setting = readoutSetting('android', info);
    await expect(setting.read()).resolves.toBe(true);
    setting.subscribe(vi.fn());
    expect(events).toEqual(['accessibilityServiceChanged']);
  });

  it('follows the screen reader off Android', async () => {
    const { info, events } = fakeAccessibilityInfo(true, false);
    const setting = readoutSetting('ios', info);
    await expect(setting.read()).resolves.toBe(true);
    setting.subscribe(vi.fn());
    expect(events).toEqual(['screenReaderChanged']);
  });
});
