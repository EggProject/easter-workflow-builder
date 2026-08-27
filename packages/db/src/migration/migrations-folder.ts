import path from 'node:path';

/**
 * A generált SQL migrációk mappájának abszolút útvonala, a forrásfájlhoz
 * képest számolva (SPEC-003 10.3 szekció), hogy a hívó aktuális
 * munkakönyvtárától függetlenül mindig ugyanoda mutasson.
 */
export const MIGRATIONS_FOLDER = path.join(import.meta.dirname, '..', '..', 'drizzle');
