/**
 * A JavaScript szkript `timeoutMs` mezőjének felső határa (SPEC-014 5.3): a
 * Node `setTimeout` ennél nagyobb késleltetést 1 ms-re állít, tehát a korlát
 * azonnal lejárna (research J-16, `docs/research/2026-11-03-szkript-kimenet-ertektipus.md`).
 * A `packages/protocol` ugyanezt az értéket saját konstansként tartja
 * (szándékos duplikátum); a két oldal egyezését az `apps/server`
 * `node-config-drift-protection` tesztje őrzi.
 */
export const MAX_SCRIPT_TIMEOUT_MS = 2_147_483_647;
