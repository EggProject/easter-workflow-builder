/**
 * Az üres (vagy csak szóközből álló) kötelező mező hibaüzenete, a mező alatt
 * (SPEC-008 5.4, O-21). A mentési séma (`NodeConfigSaveSchema`) a kötelező
 * szöveg mezőkre, a `null` `onUnhandledError` és a `null` `join` `mode`
 * értékre adja; az `apps/web` `node-inspector` az `agents` bejegyzés kötelező
 * mezőire ugyanezt a mondatot használja (O-38), mert ott ugyanaz az "üres"
 * jelentése, és a szabály nem a séma része.
 */
export const BLANK_FIELD_MESSAGE = 'A mező nem lehet üres.';
