import type { RunContext } from '../run-context/run-context.ts';

/**
 * Egy JavaScript szkript lépés futtatásának bemenete (SPEC-014 5.4, 5.5).
 *
 * - `source`: a csomópont `source` mezője, egy aszinkron függvény törzse.
 * - `runContext`: a futás kontextus, ugyanaz, amit a CEL kifejezés lát (SPEC-010
 *   7.3); a futtató a jelen lévő neveket JSON értékként teszi a sandbox globális
 *   objektumára, a hiányzót (például nem `join` node-nál a `joinInputs`) kihagyja.
 * - `timeoutMs`, `cwd`, `memoryLimitMb`: a tárolt mezők változatlanul; a `null`
 *   alapértéket (60 000 ms, a szerver munkakönyvtára, a rendszermemória legfeljebb
 *   2048 MB-ig) a futtató oldja fel, mert a rendszermemória csak ott ismert.
 * - `fetchResponseLimitMb`, `fileReadLimitMb`: a gazda oldali olvasási plafon
 *   (SPEC-014 5.3, 5.4 "Olvasási plafon"), a tárolt mező változatlanul; a
 *   `null` alapértéket a futtató oldja fel.
 * - `signal`: a motor külső leállítása (megszakítás, `fail_run`, SPEC-014 5.8);
 *   nem a lépés saját határideje, azt a futtató a `timeoutMs` szerint maga állítja.
 *
 * Típus-only fájl, nincs hozzá `.spec.ts`.
 */
export interface ScriptRunRequest {
  readonly source: string;
  readonly runContext: RunContext;
  readonly timeoutMs: number | null;
  readonly cwd: string | null;
  readonly memoryLimitMb: number | null;
  readonly fetchResponseLimitMb: number | null;
  readonly fileReadLimitMb: number | null;
  readonly signal: AbortSignal;
}
