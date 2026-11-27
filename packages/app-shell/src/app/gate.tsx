import { Unmatched } from 'expo-router';

import { GateScreen } from '@/gate/GateScreen';

export default function GateRoute() {
  return __DEV__ ? <GateScreen /> : <Unmatched />;
}
