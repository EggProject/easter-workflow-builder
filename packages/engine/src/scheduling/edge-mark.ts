/**
 * Egy élen álló jelölés (SPEC-004 4.4): "A vezérlés jelölésekkel terjed az
 * éleken. Két jelölés van: `live` és `dead`."
 *
 * A jelölés kulcsa az `(élazonosító, ág kontextus)` pár, ahol a kontextus az
 * **élen** álló verem, tehát a cél node példány kontextusa. Az egyetlen
 * kivétel a `join` node bejövő éle: ott az élen a belső, `fan_out` kerettel
 * bővült verem áll, a `join` példány viszont a külső veremben fut (4.5).
 */
export type EdgeMark = 'live' | 'dead';
