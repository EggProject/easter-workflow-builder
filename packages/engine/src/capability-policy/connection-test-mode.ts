/**
 * A "Kapcsolat teszt" két lehetséges menete (SPEC-004 11.3 táblázat 16. sora).
 *
 * - `sdk_model_list`: az SDK maga hívja a modell végpontot, tehát a teszt onnan
 *   ad modellistát.
 * - `minimal_query`: a teszt egyetlen minimális `query()` hívás.
 *
 * A tényleges hívást a `testProviderConnection` motor művelet végzi
 * (PLAN-005 T-005-28); ez a típus csak a menetet nevezi meg, hálózati lépést
 * nem ír le.
 */
export type ConnectionTestMode = 'sdk_model_list' | 'minimal_query';
