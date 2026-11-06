import type { OutputRoute } from '@kitbag/core-native';
import { describe, expect, it } from 'vitest';

import { isOutputRouteKind, routeDetail, routeTitle } from './routeLabel.ts';

const route = (kind: OutputRoute['kind'], name = ''): OutputRoute => ({
  id: kind,
  name,
  kind,
  certain: true,
});

describe('route label', () => {
  it('names the speaker and the jack by kind, whatever the system calls them', () => {
    expect(routeTitle(route('speaker', 'Speaker'))).toBe('Phone speaker');
    expect(routeTitle(route('wired', 'Headset'))).toBe('Wired headphones');
    expect(routeDetail(route('wired'))).toBe('3.5 mm');
    expect(routeDetail(route('speaker'))).toBeNull();
  });

  it('names a Bluetooth or USB device by its own name', () => {
    expect(routeTitle(route('bluetooth', 'WH-1000XM4'))).toBe('WH-1000XM4');
    expect(routeDetail(route('bluetooth', 'WH-1000XM4'))).toBe('Bluetooth');
    expect(routeTitle(route('usb', 'Scarlett 2i2'))).toBe('Scarlett 2i2');
    expect(routeDetail(route('usb', 'Scarlett 2i2'))).toBe('USB');
  });

  it('falls back to the kind when a device reports no name', () => {
    expect(routeTitle(route('bluetooth'))).toBe('Bluetooth');
    expect(routeTitle(route('other'))).toBe('Audio output');
  });

  it('recognises only the route kinds the engine reports', () => {
    expect(isOutputRouteKind('bluetooth')).toBe(true);
    expect(isOutputRouteKind('toString')).toBe(false);
    expect(isOutputRouteKind('hdmi')).toBe(false);
  });
});
