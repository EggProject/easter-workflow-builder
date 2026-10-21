/**
 * A hibaosztály, amivel a motor a `script` lépést futás indításkor elutasítja
 * (SPEC-008 5.1, 14. kritérium, M-87). A kártya figyelmeztetése és a "Futás
 * indítása" gomb tiltásának oka is ezt nevezi meg, ezért áll egyetlen helyen;
 * nem validáció, a motor ténye megjelenítve (`greppable-invariants` (21)).
 */
export const SCRIPT_UNIMPLEMENTED_ERROR_CLASS = 'unimplemented_node_type';
