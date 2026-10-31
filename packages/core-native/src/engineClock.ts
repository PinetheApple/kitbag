import { getEngineClockHost } from './host/KitbagHostObject.ts';
import {
  type EngineClockPair,
  readEngineClockPair,
} from './host/engineClock.ts';

export function getEngineClockPair(): EngineClockPair | null {
  return readEngineClockPair(getEngineClockHost());
}
