/**
 * A séma fordító naplózójának szerkezeti alakja (SPEC-015 5.2): a szerver
 * `ServerLogger`-e (`@easter-workflow-builder/logger`) értékadással illeszkedik
 * rá. Szerkezeti típus, nem a `ServerLogger` importja, mert az a `pino`
 * típusdeklarációit is behúzná ebbe a csomagba (a `packages/logger`
 * `tsconfig.json` `skipLibCheck` indoka).
 *
 * Típus-only fájl, nincs hozzá `.spec.ts` (a csomag CLAUDE.md `## Fájlok`
 * táblázata jelöli).
 */
export interface StructuredOutputSchemaLogger {
  info(bindings: Readonly<Record<string, unknown>>, message: string): void;
  warn(bindings: Readonly<Record<string, unknown>>, message: string): void;
  error(bindings: Readonly<Record<string, unknown>>, message: string): void;
}
