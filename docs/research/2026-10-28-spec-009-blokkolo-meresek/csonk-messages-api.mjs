// Helyi Messages API csonk a SPEC-009 M-136 és M-139 méréséhez (valódi API hívás nélkül).
// Minden kérést naplóz (módszer, útvonal, a törzs kivonata), és Messages API alakú választ ad:
// `stream: true` kérésre SSE eseménysort, különben JSON-t. A válasz a `dontes` callbacktől függ:
// `{ eszkoz: { name, input } }` esetén `tool_use` blokk, különben egy rövid szöveg.
import http from 'node:http';

function sse(res, events) {
  res.writeHead(200, { 'content-type': 'text/event-stream', 'cache-control': 'no-cache' });
  for (const [event, data] of events) {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  }
  res.end();
}

function uzenet(model, blokk, stopReason) {
  return {
    id: 'msg_csonk',
    type: 'message',
    role: 'assistant',
    model,
    content: [blokk],
    stop_reason: stopReason,
    stop_sequence: null,
    usage: { input_tokens: 1, output_tokens: 1 },
  };
}

function streamEsemenyek(model, blokk, stopReason) {
  const ures = blokk.type === 'tool_use' ? { ...blokk, input: {} } : { type: 'text', text: '' };
  const delta =
    blokk.type === 'tool_use'
      ? { type: 'input_json_delta', partial_json: JSON.stringify(blokk.input) }
      : { type: 'text_delta', text: blokk.text };
  return [
    ['message_start', { type: 'message_start', message: { ...uzenet(model, blokk, null), content: [] } }],
    ['content_block_start', { type: 'content_block_start', index: 0, content_block: ures }],
    ['content_block_delta', { type: 'content_block_delta', index: 0, delta }],
    ['content_block_stop', { type: 'content_block_stop', index: 0 }],
    [
      'message_delta',
      { type: 'message_delta', delta: { stop_reason: stopReason, stop_sequence: null }, usage: { output_tokens: 1 } },
    ],
    ['message_stop', { type: 'message_stop' }],
  ];
}

/**
 * @param {(body: Record<string, unknown>) => { eszkoz?: { name: string, input: unknown } }} dontes
 * @param {(bejegyzes: Record<string, unknown>) => void} naplo
 */
export function inditCsonk(dontes, naplo) {
  const server = http.createServer((req, res) => {
    const darabok = [];
    req.on('data', (d) => darabok.push(d));
    req.on('end', () => {
      const nyers = Buffer.concat(darabok).toString('utf8');
      let body = {};
      try {
        body = nyers.length > 0 ? JSON.parse(nyers) : {};
      } catch {
        body = {};
      }
      const kerdes = { metodus: req.method, utvonal: req.url, body };
      if (req.method === 'POST' && typeof req.url === 'string' && req.url.startsWith('/v1/messages')) {
        if (req.url.startsWith('/v1/messages/count_tokens')) {
          naplo({ ...kerdes, valasz: 'count_tokens' });
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ input_tokens: 1 }));
          return;
        }
        const d = dontes(body);
        const model = typeof body.model === 'string' ? body.model : 'csonk';
        const blokk =
          d.eszkoz === undefined
            ? { type: 'text', text: 'csonk valasz' }
            : { type: 'tool_use', id: `toolu_csonk_${Date.now()}`, name: d.eszkoz.name, input: d.eszkoz.input };
        const stopReason = blokk.type === 'tool_use' ? 'tool_use' : 'end_turn';
        naplo({ ...kerdes, valasz: blokk.type === 'tool_use' ? `tool_use ${blokk.name}` : 'text' });
        if (body.stream === true) sse(res, streamEsemenyek(model, blokk, stopReason));
        else {
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify(uzenet(model, blokk, stopReason)));
        }
        return;
      }
      naplo({ ...kerdes, valasz: 404 });
      res.writeHead(404, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ type: 'error', error: { type: 'not_found_error', message: 'csonk' } }));
    });
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const cim = server.address();
      const port = typeof cim === 'object' && cim !== null ? cim.port : 0;
      resolve({ url: `http://127.0.0.1:${port}`, zar: () => new Promise((r) => server.close(() => r())) });
    });
  });
}
