/**
 * A lépés session módja (SPEC-003 4.5 szekció). Az `isolated` friss sessiont
 * indít, a `continued` az előző lépés session azonosítójával `resume`-ol
 * (párhuzamos ágnál `forkSession: true` mellett). A tényleges session
 * azonosítót nem ez a típus, hanem a `step_run` sor hordozza.
 */
export type SessionMode = 'isolated' | 'continued';
