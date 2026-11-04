/**
 * A JavaScript szkript `memoryLimitMb` mezőjének alsó határa (SPEC-014 5.3): a
 * pinelt QuickJS WebAssembly modul a deklarált kezdő méreténél (256 lap, 16 MB)
 * kisebb saját memóriával nem példányosítható (research Q-9,
 * `docs/research/2026-11-04-szkript-csomopont.md`). A `packages/protocol`
 * ugyanezt az értéket saját konstansként tartja (szándékos duplikátum); a két
 * oldal egyezését az `apps/server` `node-config-drift-protection` tesztje őrzi.
 */
export const MIN_SCRIPT_MEMORY_LIMIT_MB = 16;
