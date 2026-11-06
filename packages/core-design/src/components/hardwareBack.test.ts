import { afterEach, expect, it, vi } from 'vitest';

const remove = vi.fn();
const addEventListener = vi.fn(() => ({ remove }));
vi.mock('react-native', () => ({ BackHandler: { addEventListener } }));

const { onHardwareBack } = await import('./hardwareBack.ts');

afterEach(() => {
  vi.clearAllMocks();
});

it('consumes the hardware back press and runs the handler', () => {
  const handler = vi.fn();
  onHardwareBack(handler);
  const [event, listener] = addEventListener.mock.calls[0] as unknown as [
    string,
    () => boolean,
  ];
  expect(event).toBe('hardwareBackPress');
  expect(listener()).toBe(true);
  expect(handler).toHaveBeenCalledOnce();
});

it('removes the listener on release', () => {
  onHardwareBack(vi.fn())();
  expect(remove).toHaveBeenCalledOnce();
});
