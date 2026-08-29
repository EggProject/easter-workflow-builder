import type { ProcessEnvironmentPort } from '@easter-workflow-builder/engine';

/**
 * A folyamat környezeti változó port valódi implementációja: a `process.env`
 * felett, `null`-ra normalizálva a hiányzó/üres esetet (SPEC-004 3.2
 * táblázat, `processEnvironment` sor - a port `read` metódusa `string | null`
 * alakú, nem `string | undefined`).
 */
export function createProcessEnvironmentReader(): ProcessEnvironmentPort {
  return {
    read: (name) => {
      // eslint-disable-next-line unicorn/no-null -- a ProcessEnvironmentPort.read szerződése `string | null`, a `db` és a többi port konvenciója (SPEC-004 3.2)
      return process.env[name] ?? null;
    },
  };
}
