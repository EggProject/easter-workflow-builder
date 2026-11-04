/**
 * A mentéskor a szerver által elutasított strukturált kimenet séma (SPEC-015
 * 5.7): melyik csomópont melyik mezőjéről van szó (a `config`-on belüli
 * útvonal), és a séma melyik értékét utasította el. Amíg a csomópont
 * sémája ugyanez az érték (hivatkozás szerint), a mező alatt a hiba áll; a
 * séma szerkesztése új értéket ad, és a hiba eltűnik.
 */
export interface RejectedStructuredOutputSchema {
  readonly nodeId: string;
  readonly fieldPath: 'structuredOutput.schema' | 'settings.structuredOutput.schema';
  readonly schema: unknown;
}
