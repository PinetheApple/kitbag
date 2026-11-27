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

const DESCRIPTOR_FIELDS = [
  'value',
  'get',
  'set',
  'writable',
  'enumerable',
  'configurable',
] as const;

function descriptorFields(
  descriptor: PropertyDescriptor | undefined,
): unknown[] {
  const fields = (descriptor ?? {}) as Record<string, unknown>;
  return DESCRIPTOR_FIELDS.map((field) => fields[field]);
}

function sameDescriptor(
  a: PropertyDescriptor | undefined,
  b: PropertyDescriptor | undefined,
): boolean {
  const before = descriptorFields(a);
  return descriptorFields(b).every((value, i) => Object.is(value, before[i]));
}

export function probeGlobals(
  js: string,
  install: (global: ProbeGlobal) => void,
  afterEvaluation: (global: ProbeGlobal) => void = () => undefined,
): GlobalsProbe {
  const context = vm.createContext();
  const global = vm.runInContext('globalThis', context) as ProbeGlobal;
  install(global);
  const before = snapshot(global);
  vm.runInContext(js, context, { timeout: PROBE_TIMEOUT_MS });
  afterEvaluation(global);
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
