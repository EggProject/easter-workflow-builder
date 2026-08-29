import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import { httpStatusForErrorCode, type ProtocolErrorBody, type RouteId } from '@easter-workflow-builder/protocol';
import { matchRoute } from '../route-dispatch/match-route.ts';
import type { RouteHandler } from '../route-dispatch/route-handler.ts';
import { mapOutcomeMessageToErrorCode } from '../error-mapping/map-outcome-message-to-error-code.ts';
import { readJsonRequestBody } from './read-json-request-body.ts';
import { resolveCorsHeaders } from './resolve-cors-headers.ts';

/**
 * A `node:http` szerver összeállításának bemenete (SPEC-006 `http-server`
 * téma). A `handlers` a `ROUTE_TABLE` mind a 26 azonosítójára kötelezően
 * kitöltött rekord: egy hiányzó bejegyzés fordítási hibát ad (SPEC-006 12.
 * elfogadási kritérium), nem futásidejű "nincs kezelő" ágat.
 */
export interface HttpServerOptions {
  readonly handlers: Readonly<Record<RouteId, RouteHandler>>;
  readonly devOrigin: string | undefined;
}

function writeJson(
  response: ServerResponse,
  status: number,
  body: unknown,
  extraHeaders: Readonly<Record<string, string>>,
): void {
  if (body === undefined) {
    response.writeHead(status, { ...extraHeaders });
    response.end();
    return;
  }
  response.writeHead(status, { ...extraHeaders, 'Content-Type': 'application/json' });
  response.end(JSON.stringify(body));
}

/**
 * Az illesztett végpont teljes kiszolgálása: törzs olvasás, kezelő hívás, a
 * sikeres és a hiba ág JSON válasszá alakítása (SPEC-006 18. elfogadási
 * kritérium: a HTTP státuszt kizárólag a `protocol` `httpStatusForErrorCode`
 * adja, a 404/405 HTTP szintű ág kivételével).
 */
async function serveMatchedRoute(
  request: IncomingMessage,
  response: ServerResponse,
  routeId: RouteId,
  parameters: Readonly<Record<string, string>>,
  query: URLSearchParams,
  corsHeaders: Readonly<Record<string, string>>,
  handlers: Readonly<Record<RouteId, RouteHandler>>,
): Promise<void> {
  const bodyOutcome = await readJsonRequestBody(request);
  if (bodyOutcome.kind === 'error') {
    const body = { code: 'invalid_request', message: bodyOutcome.message } satisfies ProtocolErrorBody;
    writeJson(response, httpStatusForErrorCode('invalid_request'), body, corsHeaders);
    return;
  }

  const handler = handlers[routeId];
  const result = await handler({ parameters, query, body: bodyOutcome.value });

  if (result.kind === 'error') {
    const code = mapOutcomeMessageToErrorCode(result.message);
    const body = { code, message: result.message } satisfies ProtocolErrorBody;
    writeJson(response, httpStatusForErrorCode(code), body, corsHeaders);
    return;
  }

  writeJson(response, result.value.status, result.value.body, corsHeaders);
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  options: HttpServerOptions,
): Promise<void> {
  try {
    const url = new URL(request.url ?? '/', 'http://localhost');
    const corsHeaders = resolveCorsHeaders(url.pathname, options.devOrigin);
    const matchResult = matchRoute(request.method ?? '', url.pathname);

    if (matchResult.kind === 'not_found') {
      request.resume();
      const body = { code: 'not_found', message: 'Nincs ilyen útvonal (route_not_found).' } satisfies ProtocolErrorBody;
      writeJson(response, 404, body, corsHeaders);
      return;
    }

    if (matchResult.kind === 'method_not_allowed') {
      request.resume();
      const body = {
        code: 'not_found',
        message: 'Az útvonal létezik, de nem ezzel a metódussal (method_not_allowed).',
      } satisfies ProtocolErrorBody;
      writeJson(response, 405, body, { ...corsHeaders, Allow: matchResult.allowedMethods.join(', ') });
      return;
    }

    await serveMatchedRoute(
      request,
      response,
      matchResult.match.routeId,
      matchResult.match.parameters,
      url.searchParams,
      corsHeaders,
      options.handlers,
    );
  } catch {
    // Váratlan, kezeletlen kivétel: a válasz szándékosan nem hordozza a hiba
    // részleteit (verem nyomkövetés, üzenet), csak egy általános szöveget
    // (SPEC-006 20. elfogadási kritérium).
    writeJson(response, 500, { code: 'internal', message: 'Váratlan szerver hiba történt (internal).' }, {});
  }
}

/**
 * A `node:http` szerver létrehozása (SPEC-006 9.1 `http-server` téma). A
 * `listen` hívás és a `127.0.0.1` bind a hívó (`startup-sequence`) dolga,
 * ez a függvény csak a kérés kiszolgálást köti be.
 */
export function createHttpServer(options: HttpServerOptions): Server {
  return createServer((request, response) => {
    void handleRequest(request, response, options);
  });
}
