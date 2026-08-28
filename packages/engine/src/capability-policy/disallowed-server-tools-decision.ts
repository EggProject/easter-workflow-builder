/**
 * A nem működő szerver oldali toolok letiltásának eredménye (SPEC-004 11.3
 * táblázat 12. sora).
 *
 * A `disallowedTools` a lépés `Options.disallowedTools` listájára kerülő
 * **kliens oldali** tool nevek halmaza, kizárólag a leíró
 * `serverTools[].clientToolName` mezőjéből olvasva: a motorban egyetlen
 * konkrét tool név sem szerepel (SPEC-004 17. szekció 61. kritérium).
 *
 * A `serverToolAvailabilityUnproven` logikai, nem névlista, mert az `unknown`
 * ág éppen azt jelenti, hogy a név nem ismert: ha a teljes `serverTools`
 * mező `unknown`, egyetlen tool neve sincs meg, amit fel lehetne sorolni.
 */
export interface DisallowedServerToolsDecision {
  readonly disallowedTools: readonly string[];
  readonly serverToolAvailabilityUnproven: boolean;
}
