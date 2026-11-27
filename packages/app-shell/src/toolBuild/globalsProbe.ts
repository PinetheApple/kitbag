import vm from 'node:vm';

export interface GlobalsProbe {
  readonly added: string[];
  readonly changed: string[];
}

export type ProbeGlobal = Record<string, unknown>;

const PROBE_TIMEOUT_MS = 5000;

function snapshot(
  global: object,
): Map<PropertyKey, PropertyDescriptor | undefined> {
  return new Map(
    Reflect.ownKeys(global).map((key) => [
      key,
      Reflect.getOwnPropertyDescriptor(global, key),
    ]),
  );
}

function sameDescriptor(
  a: PropertyDescriptor | undefined,
  b: PropertyDescriptor | undefined,
): boolean {
  return (
    Object.is(a?.value, b?.value) && a?.get === b?.get && a?.set === b?.set
  );
}

export function probeGlobals(
  js: string,
  install: (global: ProbeGlobal) => void,
): GlobalsProbe {
  const context = vm.createContext();
  const global = vm.runInContext('globalThis', context) as ProbeGlobal;
  install(global);
  const before = snapshot(global);
  vm.runInContext(js, context, { timeout: PROBE_TIMEOUT_MS });
  const after = snapshot(global);
  return {
    added: [...after.keys()].filter((key) => !before.has(key)).map(String),
    changed: [...before]
      .filter(
        ([key, descriptor]) => !sameDescriptor(descriptor, after.get(key)),
      )
      .map(([key]) => String(key)),
  };
}

export function stubModule(): unknown {
  return new Proxy(
    function stub(): unknown {
      return undefined;
    },
    {
      get: (_target, key) =>
        key === Symbol.toPrimitive ? () => '' : stubModule(),
      apply: () => stubModule(),
      construct: () => stubModule() as object,
    },
  );
}
