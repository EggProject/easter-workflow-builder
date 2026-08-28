/**
 * A 429 kezelés motor oldali politikája (SPEC-004 11.3 táblázat 15. sora).
 *
 * **Ez a sor az egyetlen a tizenhat közül, ami nem elágazó függvény, hanem
 * konstans, dokumentált döntés.** Az ok kétszeres:
 *
 * 1. A motor nem lát HTTP választ. A kimenő kérést az `agentQueryRunner` port
 *    mögött az SDK indítja (SPEC-004 3.3), tehát a motorban nincs az a hely,
 *    ahol egy fejlécet ki lehetne olvasni. A leíró `known` ága ezért nem tud
 *    más motor viselkedést előírni, mint az `unknown` ága.
 * 2. Három független mérési körben, kb. 193 kérésen keresztül egyetlen 429 sem
 *    érkezett, és visszalépést kérő fejléc sem jelent meg, tehát a motor nem is
 *    építhet ilyen fejlécre (F-12).
 *
 * Az újrapróbálkozás így teljes egészében az `error_handler` node dolga
 * (SPEC-004 8.2), aminek a késleltetése a workflow-ban beállított
 * `backoffMs` listából jön, nem a motorból. A motor saját, automatikus
 * visszalépési logikát nem épít (SPEC-004 17. szekció 40. kritérium).
 */
export const RATE_LIMIT_RETRY_POLICY = {
  /**
  A motor egyetlen provider oldali korlátozási fejlécet sem olvas.
  */
  readsProviderRateLimitHeaders: false,
  /**
  A motornak nincs saját, automatikus visszalépési logikája.
  */
  buildsAutomaticBackoff: false,
  /**
  Az újrapróbálkozás egyetlen helye a workflow gráfjában.
  */
  retryOwner: 'error_handler_node',
} as const;
