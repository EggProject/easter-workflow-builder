import { createServer, type IncomingMessage, type Server, type ServerResponse } from 'node:http';
import {
  STREAM_PATH,
  httpStatusForErrorCode,
  type ProtocolErrorBody,
  type RouteId,
} from '@easter-workflow-builder/protocol';
import { matchRoute } from '../route-dispatch/match-route.ts';
import type { RouteHandler } from '../route-dispatch/route-handler.ts';
import { mapOutcomeMessageToErrorCode } from '../error-mapping/map-outcome-message-to-error-code.ts';
import {
  handleStreamConnection,
  type StreamConnectionDependencies,
} from '../stream-connection/handle-stream-connection.ts';
import { normalizeIncomingRequest } from './normalize-incoming-request.ts';
import { readJsonRequestBody } from './read-json-request-body.ts';
import { resolveCorsHeaders } from './resolve-cors-headers.ts';
import { wrapResponseAsStreamSink } from './wrap-response-as-stream-sink.ts';

/**
 * A `node:http` szerver összeállításának bemenete (SPEC-006 `http-server`
 * téma). A `handlers` a `ROUTE_TABLE` mind a 26 azonosítójára kötelezően
 * kitöltött rekord: egy hiányzó bejegyzés fordítási hibát ad (SPEC-006 12.
 * elfogadási kritérium), nem futásidejű "nincs kezelő" ágat. A
 * `streamDependencies` a `STREAM_PATH` (`GET /events`) kiszolgálásához kell
 * - az a `ROUTE_TABLE`-ön kívül áll (SPEC-005 5.2 szekció), ezért külön ág
 * vezeti, a `matchRoute` elé.
 */
export interface HttpServerOptions {
  readonly handlers: Readonly<Record<RouteId, RouteHandler>>;
  readonly devOrigin: string | undefined;
  readonly streamDependencies: StreamConnectionDependencies;
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

/**
 * A `Last-Event-ID` fejléc kiolvasása (SPEC-006 6.3). Az `IncomingHttpHeaders`
 * index szignatúrája minden fejlécnévre `string | string[] | undefined`
 * típust ad, mert ez a `set-cookie` fejlécre valódi tömböt eredményez; a
 * `last-event-id` viszont nincs a Node dokumentált "első előfordulást tartja
 * meg" listáján, tehát az ismétlődő példányokat a Node saját HTTP elemzője
 * `", "` elválasztóval EGYETLEN stringgé fűzi össze, mielőtt ez a függvény
 * egyáltalán látná (mérve: két `Last-Event-ID` fejléccel küldött nyers kérésre
 * a szerver oldali `request.headers['last-event-id']` értéke `"5, 9"`, nem
 * tömb). A tömb ág emiatt valódi Node HTTP kéréssel nem érhető el; a
 * függvény saját, exportált egysége viszont a deklarált típusa szerint
 * mindkét alakot helyesen kezeli, ezért közvetlen unit teszttel fedett
 * (`create-http-server.spec.ts`), nem a teljes HTTP kérésen át.
 */
export function readLastEventIdHeader(headerValue: string | readonly string[] | undefined): string | undefined {
  if (headerValue === undefined) {
    return undefined;
  }
  // A `typeof` ellenőrzés azért kell az `Array.isArray` helyett, mert annak
  // `arg is any[]` típusőre nem szűkíti ki a `readonly string[]` ágat a
  // negált oldalon (a `readonly string[]` nem részhalmaza az `any[]`-nek).
  return typeof headerValue === 'string' ? headerValue : headerValue[0];
}

/**
 * A `GET /events` kiszolgálása (SPEC-005 5.2, 5.5, 5.6). A státusz mindig
 * `200`, a `Content-Type` mindig `text/event-stream` karakterkódolás
 * nélkül, a `flushHeaders()` az első keret (`stream_ready`) előtt fut
 * (SPEC-006 23. elfogadási kritérium). Tömörítés nincs (F-11).
 */
function serveStreamConnection(
  request: IncomingMessage,
  response: ServerResponse,
  query: URLSearchParams,
  corsHeaders: Readonly<Record<string, string>>,
  streamDependencies: StreamConnectionDependencies,
): void {
  response.writeHead(200, {
    ...corsHeaders,
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
  });
  response.flushHeaders();

  const streamId = query.get('streamId') ?? '';
  const lastEventIdHeader = readLastEventIdHeader(request.headers['last-event-id']);
  const sink = wrapResponseAsStreamSink(response);
  const connection = handleStreamConnection(streamId, lastEventIdHeader, sink, streamDependencies);
  response.on('close', connection.handleClientClosed);
}

async function handleRequest(
  request: IncomingMessage,
  response: ServerResponse,
  options: HttpServerOptions,
): Promise<void> {
  try {
    const normalized = normalizeIncomingRequest(request.url, request.method);
    const corsHeaders = resolveCorsHeaders(normalized.pathname, options.devOrigin);

    if (normalized.pathname === STREAM_PATH && normalized.method === 'GET') {
      serveStreamConnection(request, response, normalized.searchParams, corsHeaders, options.streamDependencies);
      return;
    }

    const matchResult = matchRoute(normalized.method, normalized.pathname);

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
      normalized.searchParams,
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
