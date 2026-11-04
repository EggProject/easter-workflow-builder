/**
 * A sandbox `fetch` második argumentumának dokumentált mezői (SPEC-014 5.4
 * "Hálózat"): `method`, `headers` (név és szöveg érték), `body` (szöveg). Más
 * mező nincs; a gazda maga sem tesz hozzá hitelesítő fejlécet, sütit vagy
 * környezeti változót (5.10 4. pont).
 *
 * Típus-only fájl, nincs hozzá `.spec.ts`.
 */
export interface SandboxFetchInit {
  readonly method?: string;
  readonly headers?: Readonly<Record<string, string>>;
  readonly body?: string;
}
