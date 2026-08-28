import type { UnhandledErrorPolicy } from '@easter-workflow-builder/db';
import type { ExecutableGraph } from '../run-graph/executable-graph.ts';
import type { ErrorRoute } from './error-route.ts';

/**
 * A menekülő él `branch_key` értéke (SPEC-004 4.2 táblázat fenntartott
 * kulcsai). Három, egymástól független szabály használja ugyanazt az alakot:
 *
 * - `on_error`: **bármely** node hibája után (8.1 1. pont).
 * - `exhausted`: kizárólag az `error_handler` node kimerült kísérletei után
 *   (8.2 2. pont). Az `error_handler` kimenő élei kizárólag ezt az ágat
 *   szolgálják (8.2 5. pont), tehát a sikeres újrapróbálkozás után a vezérlés
 *   **nem** ezeken az éleken megy tovább.
 * - `rejected`: kizárólag az elutasított `human_approval` lépés után (5.8
 *   utolsó pontja: "ha van `rejected` kimenő él, a vezérlés arra megy; ha
 *   nincs, a 8.3 hibapolitika következik `approval_rejected` osztállyal").
 *   Ez szó szerint ugyanaz a döntési fa, mint a másik kettőé, csak a keresett
 *   kulcs más, ezért nem külön függvény (PLAN-005 T-005-25).
 */
export type FailureEscapeKey = 'on_error' | 'exhausted' | 'rejected';

export interface ResolveErrorRouteInput {
  readonly graph: ExecutableGraph;

  /**
   * A hibára futó node azonosítója; a menekülő élt a kimenő élei között
   * keressük.
   */
  readonly nodeId: string;

  readonly escapeKey: FailureEscapeKey;

  /**
   * A node configjának `onUnhandledError` mezője. A tárolt alak
   * `UnhandledErrorPolicy | null` (SPEC-003 4.3), de a `null` értéket a futás
   * indítási validáció már elutasította (`validateUnhandledErrorPolicy`,
   * `unhandled_error_policy_missing`), ezért ez a paraméter **nem
   * nullázható**: a szűkítés a hívó (a `run-supervisor`, T-005-25) dolga,
   * és így ebben a függvényben nem keletkezik olyan ág, ami a validáció után
   * sosem futna (`.claude/CLAUDE.md` 5. szekció, 100 százalékos lefedettség).
   */
  readonly onUnhandledError: UnhandledErrorPolicy;
}

/**
 * A SPEC-004 8.1 "A hiba útja" és 8.3 "A lépésenként állítható hibapolitika"
 * egyetlen tiszta függvényben: adatbázist nem érint, portot nem hív.
 *
 * A menet szó szerint a 8.1 két pontja:
 *
 * 1. Van-e a node-nak menekülő kimenő éle? Ha igen, a hiba **kezelt**: a
 *    vezérlés ezekre az élekre megy `live` jelöléssel, a többi kimenő élre
 *    `dead` jelöléssel.
 * 2. Ha nincs, a hiba **kezeletlen**, és a node configjának
 *    `onUnhandledError` mezője dönt (8.3).
 *
 * Amit a függvény szándékosan **nem** tesz: nem zárja le a hibára futó lépés
 * `step_run` sorát (az a végrehajtóé, és a sor `failed` állapotban is marad,
 * 8.1 zárómondata), nem szakítja meg a testvér ágakat (`fail_run` esetén az a
 * `run-supervisor` dolga), és nem dönt a futás záró állapotáról (8.4,
 * `resolveRunCompletion`).
 */
export function resolveErrorRoute(input: ResolveErrorRouteInput): ErrorRoute {
  const outgoing = input.graph.outgoingEdges.get(input.nodeId) ?? [];
  const escapeEdgeIds = new Set<string>(
    outgoing.filter((edge) => edge.branchKey === input.escapeKey).map((edge) => edge.id),
  );

  if (escapeEdgeIds.size > 0) {
    return { kind: 'handled', liveEdgeIds: escapeEdgeIds };
  }

  return input.onUnhandledError === 'fail_run' ? { kind: 'fail_run' } : { kind: 'fail_branch' };
}
