import { isRecord } from '@easter-workflow-builder/typeguards';
import type { StopHookMatcher } from './stop-hook-matcher.ts';

/**
 * A blokkoló válasz `reason` szövege, **szó szerint az M-19 mérésből**
 * (`docs/research/2026-08-26-spec000-meresi-jegyzokonyv.md`, M-19 szakasz).
 * Nem újrafogalmazott és nem kitalált szöveg: pontosan ez a mondat aktiválta a
 * blokkoló ágat mind a tíz mért futásban, és utána mind a tízben lefutott a
 * kötelező kimenet eszköz (F-5). A CLI a szöveget `"Stop hook feedback:"`
 * előtaggal, `role: "user"` üzenetként küldi ki a dróton (ugyanaz a mérés).
 */
const STOP_HOOK_BLOCK_REASON = 'Az emit_output tool még nem futott le -- kérlek hívd meg a végeredménnyel.';

/**
 * A `stop_hook_active` bemeneti mező igaz-e. A `Stop` hook bemenete a porton
 * `unknown`, mert a motor egyetlen sora sem függ az SDK típusdefiníciójától
 * (SPEC-004 3.3); a mezőnév szó szerint az SDK-é (F-4, `StopHookInput`).
 */
function isStopHookActive(input: unknown): boolean {
  return isRecord(input) && input['stop_hook_active'] === true;
}

/**
 * A kötelező kimenet eszközt kikényszerítő `Stop` hook összeállítása
 * (SPEC-004 11.3 táblázat 2. sora, F-4, F-5).
 *
 * A hook `decision: "block"` és a kötelező `reason` kombinációval küldi vissza
 * dolgozni az agentet, ha az anélkül állna le, hogy a kimenetet kiadta volna.
 * A végtelen ciklust a `stop_hook_active` bemeneti mező zárja ki: ha a hook
 * **már** egy blokkolás miatt fut, üres objektumot ad, tehát a leállás
 * átmegy. Ez pontosan az M-19 mérés beállítása, ahol mind a tíz futásban
 * egyszer aktiválódott a blokkoló ág, `num_turns: 3` mellett (F-5).
 *
 * **Miért nem néz rá, megérkezett-e már a kimenet.** A `Stop` hook bemenete
 * nem hordoz erről bizonyítékot, a motor pedig nem tippel: a tényleges
 * utóellenőrzés a `result` üzeneten történik, a lépés zárásakor (5.2 9. pont,
 * F-6). A hook feladata ennél szűkebb: egyszer visszaküldi dolgozni az
 * agentet.
 *
 * **A matcher mező hiánya szándékos.** A `Stop` esemény a `matcher` mintát
 * figyelmen kívül hagyja, tehát a bejegyzés kizárólag a visszahívást hordozza
 * (https://code.claude.com/docs/en/agent-sdk/hooks, "Hook not firing"
 * szakasz). A `timeout` mezőt sem állítjuk: arra nincs mérésünk, tehát számot
 * nem adunk (`.claude/CLAUDE.md` 4.).
 */
export function buildStopHookMatcher(): StopHookMatcher {
  return {
    hooks: [(input: unknown) => (isStopHookActive(input) ? {} : { decision: 'block', reason: STOP_HOOK_BLOCK_REASON })],
  };
}
