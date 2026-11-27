import { useEffect, useState } from 'react';
import { Text } from 'react-native';

import { checkHbcVersions, checkMismatchedHbc, reportAlive } from './hbcChecks';

export const HBC_CHECKS = {
  version: checkHbcVersions,
  mismatch: checkMismatchedHbc,
} as const;

export type HbcCheckName = keyof typeof HBC_CHECKS;

const ALIVE_AFTER_MS = 2000;
const PENDING = 'running';

export function isHbcCheck(name: string | undefined): name is HbcCheckName {
  return name !== undefined && Object.hasOwn(HBC_CHECKS, name);
}

interface HbcCheckProps {
  readonly name: HbcCheckName;
  readonly textColor: string;
}

export function HbcCheck({ name, textColor }: HbcCheckProps) {
  const [result, setResult] = useState(PENDING);

  useEffect(() => {
    setResult(HBC_CHECKS[name]());
    const id = setTimeout(reportAlive, ALIVE_AFTER_MS, name);
    return () => {
      clearTimeout(id);
    };
  }, [name]);

  return <Text style={{ color: textColor }}>{result}</Text>;
}
