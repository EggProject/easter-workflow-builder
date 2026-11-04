import { isRecord, isStringArray } from '@easter-workflow-builder/typeguards';

/**
 * Hibás-e egy `choice` opciólista: üres, vagy van `trim()` után üres eleme,
 * vagy két eleme azonos. A nem szövegtömb érték a séma saját típushibája,
 * ahhoz nem kerül második hiba.
 */
function isInvalidOptionList(options: unknown): boolean {
  return (
    isStringArray(options) &&
    (options.length === 0 || options.some((option) => option.trim() === '') || new Set(options).size !== options.length)
  );
}

/**
 * Egy `start` node config azon `choice` mezőinek konkrét `options` útvonala
 * (`['inputFields', 0, 'options']`), amelyeknek a listája nem üres, nem üres
 * elemű és egyedi elemű szabályt sért (SPEC-016 5.3). A szabály a `db`
 * `isNodeConfig` guardjának szándékos duplikátuma; a két oldal mezőnkénti
 * egyezését az `apps/server` `node-config-drift-protection` tesztje őrzi.
 *
 * A bemenet `unknown`: ahol a config nem objektum, az `inputFields` nem lista,
 * a mező nem objektum vagy nem `choice` típusú, ott nincs találat, mert az
 * alakról a séma dönt.
 */
export function findInvalidChoiceOptions(value: unknown): readonly (readonly (string | number)[])[] {
  const inputFields = isRecord(value) ? value['inputFields'] : undefined;
  if (!Array.isArray(inputFields)) {
    return [];
  }
  return inputFields.flatMap((field: unknown, index: number) =>
    isRecord(field) && field['valueKind'] === 'choice' && isInvalidOptionList(field['options'])
      ? [['inputFields', index, 'options']]
      : [],
  );
}
