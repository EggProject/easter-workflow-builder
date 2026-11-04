import { totalmem } from 'node:os';
import { SCRIPT_SANDBOX_LIMITS } from './script-sandbox-limits.ts';

/**
 * A lépés memória korlátja MB-ban (SPEC-014 5.4 "Memória", user döntés
 * 2026-11-04: "default teljes rendszermemoria"). A beállított értéket a guard
 * már 16 ... 2048 közé szorította (SPEC-014 5.3), tehát változatlanul megy
 * tovább; a `null` a teljes rendszermemória egész MB-ra lefelé kerekítve, de
 * legfeljebb a modul plafonja (research `2026-11-04-szkript-csomopont.md` Q-9).
 */
export function resolveMemoryLimitMb(memoryLimitMb: number | null): number {
  return memoryLimitMb ?? Math.min(Math.floor(totalmem() / 2 ** 20), SCRIPT_SANDBOX_LIMITS.moduleMemoryCeilingMb);
}
