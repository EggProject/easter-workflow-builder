/**
 * A JavaScript szkript `memoryLimitMb` mezőjének felső határa (SPEC-014 5.3): a
 * pinelt QuickJS WebAssembly modul a deklarált maximumánál (32768 lap, 2048 MB)
 * nagyobb saját memóriával nem példányosítható (research Q-9,
 * `docs/research/2026-11-04-szkript-csomopont.md`). A `packages/protocol`
 * ugyanezt az értéket saját konstansként tartja (szándékos duplikátum); a két
 * oldal egyezését az `apps/server` `node-config-drift-protection` tesztje őrzi.
 */
export const MAX_SCRIPT_MEMORY_LIMIT_MB = 2048;
