import { isRecord, isString } from '@easter-workflow-builder/typeguards';
import { isForbiddenScriptCwd } from './is-forbidden-script-cwd.ts';

/**
 * Egy ponttal összefűzött mezőútvonal (`settings.cwd`) értéke, ha az szöveg és
 * lexikálisan a `/proc` vagy a `/dev` alá mutat (`isForbiddenScriptCwd`): a
 * találat a mező konkrét útvonala (SPEC-014 5.9). A bemenet `unknown`; ahol az
 * útvonal nem a várt alakra mutat, vagy az érték nem szöveg (`null`, típushiba),
 * nincs találat, a `findIntegerFieldsOutsideRange` mintájára.
 */
export function findForbiddenScriptCwdFields(value: unknown, path: string): readonly (readonly string[])[] {
  const segments = path.split('.');
  let current: unknown = value;
  for (const segment of segments) {
    if (!isRecord(current)) {
      return [];
    }
    current = current[segment];
  }
  return isString(current) && isForbiddenScriptCwd(current) ? [segments] : [];
}
