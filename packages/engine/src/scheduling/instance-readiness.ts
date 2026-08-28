/**
 * Egy node példány ütemezési állapota a bejövő jelölései alapján
 * (SPEC-004 4.4 2. és 3. pont):
 *
 * - `waiting`: legalább egy bejövő élhez még nem tartozik jelölés az adott ág
 *   kontextusban, tehát a példány sem nem futtatható, sem nem halott.
 * - `live`: minden bejövő élhez tartozik jelölés, és legalább egy `live`; a
 *   példány futtatható.
 * - `dead`: minden bejövő jelölés `dead`, tehát a példány maga is halott. Nem
 *   keletkezik hozzá `step_run` sor, és minden kimenő élére `dead` jelölés
 *   kerül (halott ág továbbterjesztés).
 */
export type InstanceReadiness = 'waiting' | 'live' | 'dead';
