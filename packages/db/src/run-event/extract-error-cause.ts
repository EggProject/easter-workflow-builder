/**
 * Kiszedi egy elkapott hiba `.cause` mezőjét, `unknown` bemenetre és
 * kimenetre (a `catch` blokk típusa `unknown`, `as` kényszerítés tilos).
 *
 * Miért külön fájl, miért nem egy soros ternary a hívási helyen
 * (`run-event-repository.ts` `insertSdkEventRow`): a `database.run(sql...)`
 * (Drizzle `BaseSQLiteDatabase.run`) minden hibát egy `DrizzleError`-ba
 * csomagol, ami mindig `Error` példány - tehát a hívási helyen az
 * `error instanceof Error` ág "false" oldala a gyakorlatban sosem áll elő,
 * a 100%-os branch lefedettségi követelmény (SPEC-003 12.4 szekció) mellett
 * viszont ez egy le nem fedhető ágat hagyna ott. Ide kiemelve a függvény
 * önmagában, szintetikus (nem `Error`) bemenettel is tesztelhető - ugyanaz a
 * minta, mint a `core` csomag `describeError`-ja
 * (`packages/core/src/http-client/error-description/describe-error.ts`).
 */
export function extractErrorCause(error: unknown): unknown {
  return error instanceof Error ? error.cause : undefined;
}
