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
import { createServer, request as httpRequest, type IncomingHttpHeaders, type IncomingMessage, type OutgoingHttpHeaders, type ServerResponse } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { URL } from 'node:url';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { TransactionRecorder } from './proxy/recorder.ts';
import type { StreamEventRecord } from './proxy/types.ts';

const moduleDir = dirname(fileURLToPath(import.meta.url));

const port = Number(process.env.WIRE_PROBE_PORT ?? 8787);
const upstream = process.env.WIRE_PROBE_UPSTREAM ?? 'https://api.minimax.io/anthropic';
const artifactsDir = process.env.WIRE_PROBE_ARTIFACTS_DIR ?? join(moduleDir, '..', 'artifacts');

const upstreamUrl = new URL(upstream);
const upstreamOrigin = `${upstreamUrl.protocol}//${upstreamUrl.host}`;

const secretEnvValue = process.env.MINIMAX_API_KEY;
const recorder = new TransactionRecorder(artifactsDir, secretEnvValue ? [secretEnvValue] : []);

/** Node http/https headerobjektumot sík string->string alakra hoz (a value string vagy string[] lehet). */
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

/** A teljes kérés törzsét bufferbe olvassa, hogy bájtazonosan tovább lehessen küldeni. */
function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

/** JSON-ként próbálja értelmezni a bufferet; ha nem sikerül, nyers stringet ad vissza. */
function parseJsonOrRaw(buffer: Buffer): unknown {
  if (buffer.length === 0) {
    return null;
  }
  const text = buffer.toString('utf8');
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

async function handleRequest(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const startedAt = Date.now();
  const timestamp = new Date(startedAt).toISOString();

  const requestHeaders = toPlainHeaders(req.headers);
  const bodyBuffer = await readBody(req);
  const requestBody = parseJsonOrRaw(bodyBuffer);

  const targetUrl = new URL(req.url ?? '/', upstreamOrigin);

  // A továbbított headerek: minden bejövő header változatlanul, a host kivételével.
  const forwardHeaders: OutgoingHttpHeaders = {};
  for (const [name, value] of Object.entries(req.headers)) {
    if (value === undefined || name.toLowerCase() === 'host') {
      continue;
    }
    forwardHeaders[name] = value;
  }
  forwardHeaders['host'] = targetUrl.host;

  const requestFn = targetUrl.protocol === 'https:' ? httpsRequest : httpRequest;

  const upstreamReq = requestFn(
    targetUrl,
    { method: req.method, headers: forwardHeaders },
    (upstreamRes) => {
      const responseHeaders = toPlainHeaders(upstreamRes.headers);
      const statusCode = upstreamRes.statusCode ?? 0;
      const contentType = responseHeaders['content-type'] ?? '';
      const isStream = contentType.includes('text/event-stream');

      // A válasz státuszkódját és headereit változatlanul adjuk tovább.
      res.writeHead(statusCode, upstreamRes.headers);

      const responseChunks: Buffer[] = [];
      const streamEvents: StreamEventRecord[] = [];
      let lineBuffer = '';

      upstreamRes.on('data', (chunk: Buffer) => {
        // Darabonként azonnal továbbítjuk, nem puffereljük a stream mérés miatt.
        res.write(chunk);
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

      upstreamRes.on('end', () => {
        res.end();
        if (isStream && lineBuffer.length > 0) {
          streamEvents.push({ t: Date.now() - startedAt, raw: lineBuffer });
        }
        const responseBody = isStream ? null : parseJsonOrRaw(Buffer.concat(responseChunks));
        recorder.record({
          timestamp,
          method: req.method ?? '',
          path: targetUrl.pathname,
          query: targetUrl.search.replace(/^\?/, ''),
          requestHeaders,
          requestBody,
          responseStatus: statusCode,
          responseHeaders,
          responseBody,
          streamEvents: isStream ? streamEvents : null,
          durationMs: Date.now() - startedAt,
        });
      });
    },
  );

  upstreamReq.on('error', (err: Error) => {
    console.error(`[wire-probe proxy] upstream hiba: ${err.message}`);
    if (!res.headersSent) {
      res.writeHead(502, { 'content-type': 'application/json' });
    }
    res.end(JSON.stringify({ type: 'error', error: { type: 'wire_probe_proxy_error', message: err.message } }));
  });

  upstreamReq.write(bodyBuffer);
  upstreamReq.end();
}

const server = createServer((req, res) => {
  void handleRequest(req, res);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`[wire-probe proxy] figyel: http://127.0.0.1:${port}`);
  console.log(`[wire-probe proxy] upstream: ${upstream}`);
  console.log(`[wire-probe proxy] artefaktumok: ${artifactsDir}`);
});

function shutdown(): void {
  console.log(`[wire-probe proxy] leállítva -- rögzített tranzakciók: ${recorder.count}, könyvtár: ${recorder.artifactsDir}`);
  server.close(() => process.exit(0));
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
