import type * as Native from './hardwareBack.ts';

export const onHardwareBack: typeof Native.onHardwareBack = () => () =>
  undefined;
