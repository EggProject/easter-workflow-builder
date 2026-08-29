import { isString } from '@easter-workflow-builder/typeguards';
import type { RouteId } from './route-table.ts';

/**
 * A `ROUTE_TABLE` mind a 26 kulcsa, `Record<RouteId, true>` alakban (ugyanaz
 * a minta, mint a `packages/engine` `is-engine-error-kind.ts`
 * `ENGINE_ERROR_KIND_KEYS`-e): ha a `ROUTE_TABLE` egy huszonhetedik
 * végponttal bővül, ez a lista - és emiatt a guard - fordítási hibával jelzi
 * az elmaradást, nem hallgat róla.
 */
const ROUTE_ID_KEYS: Readonly<Record<RouteId, true>> = {
  listWorkflows: true,
  createWorkflow: true,
  getWorkflow: true,
  updateWorkflow: true,
  deleteWorkflow: true,
  summarizeWorkflowDeletion: true,
  readWorkflowGraph: true,
  replaceWorkflowGraph: true,
  startRun: true,
  listRuns: true,
  getRun: true,
  readRunSnapshot: true,
  listStepRuns: true,
  readRunEvents: true,
  interruptRun: true,
  restartRun: true,
  listPendingApprovals: true,
  decideApproval: true,
  listProviders: true,
  testProviderConnection: true,
  readSettings: true,
  updateSettings: true,
  listConcurrencyLimits: true,
  setConcurrencyLimit: true,
  clearConcurrencyLimit: true,
  replaceStreamSubscriptions: true,
};

/**
 * A `RouteId` unió egyike-e a bemenet. Kötelező azért, mert az
 * `Object.keys`/`Object.entries` a `ROUTE_TABLE`-ön mindig `string` kulcsot
 * ad vissza, sosem a szűkebb `RouteId` uniót (a hívó, `apps/server`
 * `route-dispatch` témája, ezért nem tud `as` kényszerítés nélkül visszaírni
 * `RouteId` típusra).
 */
export function isRouteId(value: unknown): value is RouteId {
  return isString(value) && Object.hasOwn(ROUTE_ID_KEYS, value);
}
