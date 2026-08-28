/**
 * Egy hibára futó node példány után a vezérlés útja (SPEC-004 8.1 és 8.3).
 * A `resolveErrorRoute` adja vissza; a téma egyetlen sora sem hajtja végre a
 * döntést, csak kimondja - a tényleges jelölés írás a `scheduling` témáé, a
 * testvér ágak megszakítása a `run-supervisor`-é (T-005-25).
 *
 * - `handled`: van menekülő él (8.1 1. pont: `on_error`, illetve az
 *   `error_handler` node kimerült kísérletei után `exhausted`, 8.2 2. pont).
 *   A `liveEdgeIds` ezeknek az éleknek az azonosítója; a node **minden más**
 *   kimenő éle `dead` jelölést kap (4.4 5. pont). A halmaz sosem üres: üres
 *   halmaz esetén a route nem `handled`.
 * - `fail_run`: nincs menekülő él, és a node configjának `onUnhandledError`
 *   mezője `fail_run` (8.3): a teljes futás leáll, a motor megszakítja a többi
 *   futó lépést. **Ezt a megszakítást ez a téma nem végzi el**, csak kiadja a
 *   döntést.
 * - `fail_branch`: nincs menekülő él, és a politika `fail_branch` (8.3): csak
 *   ez az ág hal el, tehát a node **minden** kimenő éle `dead` jelölést kap, a
 *   többi ág fut tovább. A futás záró állapota így is `failed` lesz (8.4,
 *   `resolveRunCompletion`).
 */
export type ErrorRoute =
  | { readonly kind: 'handled'; readonly liveEdgeIds: ReadonlySet<string> }
  | { readonly kind: 'fail_run' }
  | { readonly kind: 'fail_branch' };
