export const TRANSPORT_ACTIONS = [
  'tempo_down',
  'play',
  'pause',
  'tempo_up',
  'stop',
] as const;

export type TransportActionName = (typeof TRANSPORT_ACTIONS)[number];

export function transportActionNamed(
  name: string,
): TransportActionName | undefined {
  return TRANSPORT_ACTIONS.find((action) => action === name);
}
