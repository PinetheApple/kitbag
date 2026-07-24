import { GateScreen } from '@/gate/GateScreen';

// Route for the §13.3 60fps gate (SPEC §15 "one screen and no product").
// The real jitter/sweep measurement is device-side (#33).
export default function GateRoute() {
  return <GateScreen />;
}
