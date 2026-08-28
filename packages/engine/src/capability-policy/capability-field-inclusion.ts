/**
 * Egy leírótól függő kérés mező sorsa a kimenő `Options` objektumban
 * (SPEC-004 11.3 táblázat 8. és 9. sora): a motor vagy továbbadja a lépés
 * beállítását, vagy **elhagyja** a mezőt.
 *
 * Harmadik állapot nincs: tippelt értékkel kiküldeni a mezőt tilos
 * (SPEC-004 11.2, "a motor soha nem tippel egy `unknown` mező helyére
 * értéket"), tehát az `unknown` ág konzervatív visszaesése mindig az
 * elhagyás.
 */
export type CapabilityFieldInclusion = 'include' | 'omit';
