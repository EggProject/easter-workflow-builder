import type { StructuredOutputValidator } from '@easter-workflow-builder/agent';
import type { Outcome } from '@easter-workflow-builder/core';

/**
 * A strukturált kimenet sémájának fordító portja (SPEC-015 5.4, 5.7). A
 * futás indítása ezen át fordítja le minden strukturált kimenetet váró lépés
 * sémáját (`run-validation/validate-structured-output-schemas.ts`), és a
 * lefordított ellenőrzőt a lépés kapja meg (`AgentStepRequest`), tehát a
 * lépés kimenetét ugyanaz a fordítás ellenőrzi, ami az indításkor lefutott.
 *
 * **Miért port, nem közvetlen import.** A fordító (`agent` csomag
 * `compileStructuredOutputSchema`) a figyelmeztetéseit a szerver naplózójába
 * írja, a motor viszont naplózót nem ismer. A szerver összeállítása ugyanazt a
 * fordítót adja ide és a gráf mentésének ellenőrzéséhez is
 * (`apps/server` `build-engine-dependencies.ts`, `replace-workflow-graph.ts`).
 *
 * Típus-only fájl, nincs hozzá `.spec.ts`.
 */
export interface StructuredOutputSchemaCompilerPort {
  compile(schema: unknown): Outcome<StructuredOutputValidator>;
}
