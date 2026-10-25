/**
 * A CEL környezet hét deklarált változója, a motor `RunContext` mezőinek neve
 * (SPEC-010 5.1, 7.1). A csomag a motor típusát nem importálhatja (3.1), ezért
 * a lista szándékos duplikátum; az egyezést az `apps/server` sodródás védelme
 * őrzi (11.2).
 */
export const RUN_CONTEXT_VARIABLE_NAMES = [
  'input',
  'steps',
  'item',
  'itemIndex',
  'iteration',
  'joinInputs',
  'error',
] as const;
