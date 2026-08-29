import { API_BASE_PATH } from './api-base-path.ts';

/**
 * A REST végpontok HTTP metódusa. Az öt érték a SPEC-005 4.2 táblázatában
 * ténylegesen előforduló metódusok zárt halmaza.
 */
export type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

/**
 * Egy végpont metódusa és útvonal sablonja. A sablon `:paramNév` alakú
 * helyőrzőket tartalmazhat, amit a `buildRoutePath` (`build-route-path.ts`)
 * helyettesít be. A SPEC-005 4.2 táblázata `{paramNév}` alakban írja le
 * ugyanezt a helyőrzőt (dokumentációs, OpenAPI-szerű jelölés) - a kettő
 * ugyanazt a paramétert nevezi meg, a kettőspontos alak a lint szabály
 * (`unicorn/no-incorrect-template-string-interpolation`, ami a kapcsos
 * zárójeles alakot elgépelt `${...}` interpolációnak nézné) miatti,
 * szuppresszió nélküli megoldás.
 */
export interface RouteDefinition {
  readonly method: HttpMethod;
  readonly template: string;
}

/**
 * A SPEC-005 4.2 táblázatának mind a 26 REST végpontja (11. kritérium). A
 * kulcsnév a végpont felelősségét nevezi meg, nem a HTTP metódust vagy az
 * útvonalat, hogy a hívó (`apps/server`) olvasható azonosítóval hivatkozhasson
 * rá. A `GET /events` stream végpont szándékosan NEM tagja ennek a
 * táblázatnak: az nem REST végpont, a `STREAM_PATH` konstans (`stream-path.ts`)
 * adja az útvonalát, paraméter helyettesítés nélkül (5.2 szekció).
 */
export const ROUTE_TABLE = {
  // A. Workflow (8 végpont)
  listWorkflows: { method: 'GET', template: `${API_BASE_PATH}/workflows` },
  createWorkflow: { method: 'POST', template: `${API_BASE_PATH}/workflows` },
  getWorkflow: { method: 'GET', template: `${API_BASE_PATH}/workflows/:workflowId` },
  updateWorkflow: { method: 'PATCH', template: `${API_BASE_PATH}/workflows/:workflowId` },
  deleteWorkflow: { method: 'DELETE', template: `${API_BASE_PATH}/workflows/:workflowId` },
  summarizeWorkflowDeletion: {
    method: 'GET',
    template: `${API_BASE_PATH}/workflows/:workflowId/deletion-summary`,
  },
  readWorkflowGraph: { method: 'GET', template: `${API_BASE_PATH}/workflows/:workflowId/graph` },
  replaceWorkflowGraph: { method: 'PUT', template: `${API_BASE_PATH}/workflows/:workflowId/graph` },

  // B. Futás (8 végpont)
  startRun: { method: 'POST', template: `${API_BASE_PATH}/workflows/:workflowId/runs` },
  listRuns: { method: 'GET', template: `${API_BASE_PATH}/runs` },
  getRun: { method: 'GET', template: `${API_BASE_PATH}/runs/:runId` },
  readRunSnapshot: { method: 'GET', template: `${API_BASE_PATH}/runs/:runId/snapshot` },
  listStepRuns: { method: 'GET', template: `${API_BASE_PATH}/runs/:runId/steps` },
  readRunEvents: { method: 'GET', template: `${API_BASE_PATH}/runs/:runId/events` },
  interruptRun: { method: 'POST', template: `${API_BASE_PATH}/runs/:runId/interrupt` },
  restartRun: { method: 'POST', template: `${API_BASE_PATH}/runs/:runId/restart` },

  // C. Jóváhagyás (2 végpont)
  listPendingApprovals: { method: 'GET', template: `${API_BASE_PATH}/approvals` },
  decideApproval: { method: 'POST', template: `${API_BASE_PATH}/approvals/:approvalId/decision` },

  // D. Provider (2 végpont)
  listProviders: { method: 'GET', template: `${API_BASE_PATH}/providers` },
  testProviderConnection: {
    method: 'POST',
    template: `${API_BASE_PATH}/providers/:providerId/connection-test`,
  },

  // E. Beállítás (5 végpont)
  readSettings: { method: 'GET', template: `${API_BASE_PATH}/settings` },
  updateSettings: { method: 'PUT', template: `${API_BASE_PATH}/settings` },
  listConcurrencyLimits: { method: 'GET', template: `${API_BASE_PATH}/settings/concurrency-limits` },
  setConcurrencyLimit: {
    method: 'PUT',
    template: `${API_BASE_PATH}/settings/concurrency-limits/:providerId`,
  },
  clearConcurrencyLimit: {
    method: 'DELETE',
    template: `${API_BASE_PATH}/settings/concurrency-limits/:providerId`,
  },

  // F. Stream vezérlés (1 REST végpont, a stream maga a STREAM_PATH-on áll)
  replaceStreamSubscriptions: {
    method: 'PUT',
    template: `${API_BASE_PATH}/streams/:streamId/subscriptions`,
  },
} as const satisfies Readonly<Record<string, RouteDefinition>>;

// A `ROUTE_TABLE` kulcsainak uniója: minden REST végpont azonosítója.
export type RouteId = keyof typeof ROUTE_TABLE;
