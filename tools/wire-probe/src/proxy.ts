#!/usr/bin/env node
/**
 * Logoló reverse proxy a SPEC-000 drótszintű méréshez.
 *
 * Minden bejövő kérést változatlanul továbbít az upstreamre (nincs
 * útvonal-fehérlista), a választ darabonként azonnal visszaküldi (streaming
 * mérésnél ez kritikus), és közben minden tranzakciót maszkolva rögzít az
 * `artifacts/` könyvtárba.
 *
 * Útvonal-konvenció: a proxy tisztán origin-cserét végez -- a bejövő
 * `req.url`-t (path + query, változatlanul) az upstream origin-jéhez fűzi.
 * Ezért az `ANTHROPIC_BASE_URL`-nek, amit a harness a proxyra állít, ugyanazt
 * az útvonal-előtagot kell tartalmaznia, mint az upstream URL-nek (pl. mindkettő
 * végén `/anthropic`), lásd SPEC-000 4. szekció "Közös alapbeállítás".
 */
import {
  createServer,
  request as httpRequest,
  type IncomingHttpHeaders,
  type IncomingMessage,
  type OutgoingHttpHeaders,
  type ServerResponse,
} from 'node:http';
import { request as httpsRequest } from 'node:https';
import { URL, fileURLToPath } from 'node:url';
import path from 'node:path';
import { TransactionRecorder } from './proxy/recorder.ts';
import type { StreamEventRecord } from './proxy/types.ts';

const moduleDirectory = path.dirname(fileURLToPath(import.meta.url));

const port = Number(process.env['WIRE_PROBE_PORT'] ?? 8787);
const upstream = process.env['WIRE_PROBE_UPSTREAM'] ?? 'https://api.minimax.io/anthropic';
const artifactsDirectory = process.env['WIRE_PROBE_ARTIFACTS_DIR'] ?? path.join(moduleDirectory, '..', 'artifacts');

const upstreamUrl = new URL(upstream);
const upstreamOrigin = `${upstreamUrl.protocol}//${upstreamUrl.host}`;

const secretEnvironmentValue = process.env['MINIMAX_API_KEY'];
const recorder = new TransactionRecorder(artifactsDirectory, secretEnvironmentValue ? [secretEnvironmentValue] : []);

/**
Node http/https headerobjektumot sík string->string alakra hoz (a value string vagy string[] lehet).
*/
function toPlainHeaders(headers: IncomingHttpHeaders): Record<string, string> {
  const plain: Record<string, string> = {};
  for (const [name, value] of Object.entries(headers)) {
    if (value === undefined) {
      continue;
    }
    plain[name] = Array.isArray(value) ? value.join(', ') : value;
  }
  return plain;
}

/**
A teljes kérés törzsét bufferbe olvassa, hogy bájtazonosan tovább lehessen küldeni.
*/
function readBody(request: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    request.on('data', (chunk: Buffer) => {
      chunks.push(chunk);
    });
    request.on('end', () => {
      resolve(Buffer.concat(chunks));
    });
    request.on('error', reject);
  });
}

/**
JSON-ként próbálja értelmezni a bufferet; ha nem sikerül, nyers stringet ad vissza.
*/
function parseJsonOrRaw(buffer: Buffer): unknown {
  if (buffer.length === 0) {
    // `undefined` itt JSON.stringify-kor eltuntetne a kulcsot az artefaktumbol;
    // a rogzitett tranzakcioban a mezonek explicit `null`-kent kell megjelennie.
    // eslint-disable-next-line unicorn/no-null -- lasd proxy/types.ts requestBody/responseBody dokumentacioja
    return null;
  }
  const text = buffer.toString('utf8');
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
  const startedAt = Date.now();
  const timestamp = new Date(startedAt).toISOString();

  const requestHeaders = toPlainHeaders(request.headers);
  const bodyBuffer = await readBody(request);
  const requestBody = parseJsonOrRaw(bodyBuffer);

  const targetUrl = new URL(request.url ?? '/', upstreamOrigin);

  // A továbbított headerek: minden bejövő header változatlanul, a host kivételével.
  const forwardHeaders: OutgoingHttpHeaders = {};
  for (const [name, value] of Object.entries(request.headers)) {
    if (value === undefined || name.toLowerCase() === 'host') {
      continue;
    }
    forwardHeaders[name] = value;
  }
  forwardHeaders.host = targetUrl.host;

  const requestFunction = targetUrl.protocol === 'https:' ? httpsRequest : httpRequest;

  const upstreamRequest = requestFunction(
    targetUrl,
    { method: request.method, headers: forwardHeaders },
    (upstreamResponse) => {
      const responseHeaders = toPlainHeaders(upstreamResponse.headers);
      const statusCode = upstreamResponse.statusCode ?? 0;
      const contentType = responseHeaders['content-type'] ?? '';
      const isStream = contentType.includes('text/event-stream');

      // A válasz státuszkódját és headereit változatlanul adjuk tovább.
      response.writeHead(statusCode, upstreamResponse.headers);

      const responseChunks: Buffer[] = [];
      const streamEvents: StreamEventRecord[] = [];
      let lineBuffer = '';

      upstreamResponse.on('data', (chunk: Buffer) => {
        // Darabonként azonnal továbbítjuk, nem puffereljük a stream mérés miatt.
        response.write(chunk);
        if (isStream) {
          lineBuffer += chunk.toString('utf8');
          const lines = lineBuffer.split('\n');
          lineBuffer = lines.pop() ?? '';
          for (const line of lines) {
            streamEvents.push({ t: Date.now() - startedAt, raw: line });
          }
        } else {
          responseChunks.push(chunk);
        }
      });

      upstreamResponse.on('end', () => {
        response.end();
        if (isStream && lineBuffer.length > 0) {
          streamEvents.push({ t: Date.now() - startedAt, raw: lineBuffer });
        }
        // `null`, ha stream: a RecordedTransaction.responseBody dokumentalt
        // JSON-szerializacios szemantikaja, nem placeholder (lasd proxy/types.ts).
        // eslint-disable-next-line unicorn/no-null -- explicit JSON `null` kell, nem hianyzo kulcs
        const responseBody = isStream ? null : parseJsonOrRaw(Buffer.concat(responseChunks));
        recorder.record({
          timestamp,
          method: request.method ?? '',
          path: targetUrl.pathname,
          query: targetUrl.search.replace(/^\?/, ''),
          requestHeaders,
          requestBody,
          responseStatus: statusCode,
          responseHeaders,
          responseBody,
          // eslint-disable-next-line unicorn/no-null -- proxy/types.ts: nem stream valasznal dokumentaltan `null`
          streamEvents: isStream ? streamEvents : null,
          durationMs: Date.now() - startedAt,
        });
      });
    },
  );

  upstreamRequest.on('error', (error: Error) => {
    console.error(`[wire-probe proxy] upstream hiba: ${error.message}`);
    if (!response.headersSent) {
      response.writeHead(502, { 'content-type': 'application/json' });
    }
    response.end(JSON.stringify({ type: 'error', error: { type: 'wire_probe_proxy_error', message: error.message } }));
  });

  upstreamRequest.write(bodyBuffer);
  upstreamRequest.end();
}

const server = createServer((request, response) => {
  void handleRequest(request, response);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`[wire-probe proxy] figyel: http://127.0.0.1:${String(port)}`);
  console.log(`[wire-probe proxy] upstream: ${upstream}`);
  console.log(`[wire-probe proxy] artefaktumok: ${artifactsDirectory}`);
});

function shutdown(): void {
  console.log(
    `[wire-probe proxy] leállítva -- rögzített tranzakciók: ${String(recorder.count)}, könyvtár: ${recorder.artifactsDirectory}`,
  );
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
