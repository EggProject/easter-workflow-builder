// M-139 (SPEC-009 4. szekció): helyi stdio és http MCP csonk az `mcpServers` úton, a kapcsolat
// állapota és a stdio alfolyamat környezete. Futtatás: `node m139.mjs > m139-kimenet.jsonl`.
import { readFileSync } from 'node:fs';
import http from 'node:http';
import { homedir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inditCsonk } from './csonk-messages-api.mjs';
import { valaszol } from './mcp-jsonrpc.mjs';
import { betoltSdk, izoltKornyezet, ujMunkakonyvtar } from './sdk-betolto.mjs';

const ITT = path.dirname(fileURLToPath(import.meta.url));
const { sdk, verzio } = await betoltSdk();
const ki = (sor) => process.stdout.write(`${JSON.stringify(sor)}\n`);
ki({ meres: 'M-139', sdkVerzio: verzio, node: process.version });

const JELOLO = 'jelolo-ertek-nem-titok';
const AUTH = 'Bearer jelolo-fejlec-nem-titok';
process.env.EASTER_PROBE_SECRET = JELOLO;

// Http MCP csonk (Streamable HTTP, JSON válasz): naplózza a metódust és az `Authorization` fejléc meglétét.
const httpNaplo = [];
const httpMcp = http.createServer((req, res) => {
  const darabok = [];
  req.on('data', (d) => darabok.push(d));
  req.on('end', () => {
    const auth = req.headers.authorization;
    const bejegyzes = {
      metodus: req.method,
      utvonal: req.url,
      authorization: auth === undefined ? 'nincs' : auth === AUTH ? 'egyezik' : 'mas',
    };
    if (req.method !== 'POST') {
      httpNaplo.push({ ...bejegyzes, valasz: 405 });
      res.writeHead(405).end();
      return;
    }
    const uzenet = JSON.parse(Buffer.concat(darabok).toString('utf8'));
    const valasz = valaszol(uzenet, 'http-csonk');
    httpNaplo.push({ ...bejegyzes, rpc: uzenet.method, valasz: valasz === undefined ? 202 : 200 });
    if (valasz === undefined) {
      res.writeHead(202).end();
      return;
    }
    res.writeHead(200, { 'content-type': 'application/json' }).end(JSON.stringify(valasz));
  });
});
await new Promise((r) => httpMcp.listen(0, '127.0.0.1', r));
const httpUrl = `http://127.0.0.1:${httpMcp.address().port}/mcp`;
// Lezárt port a sikertelen kapcsolat esetéhez.
const halott = http.createServer();
await new Promise((r) => halott.listen(0, '127.0.0.1', r));
const halottUrl = `http://127.0.0.1:${halott.address().port}/mcp`;
await new Promise((r) => halott.close(r));

const stdioScript = path.join(ITT, 'mcp-stdio-csonk.mjs');

const VALTOZATOK = [
  {
    id: 'V1',
    leiras: 'Options.env izolalt (jelolo nelkul), MCP env egy deklaralt valtozo',
    optionsEnvJelolo: false,
    mcpEnv: { DEKLARALT_VALTOZO: 'deklaralt' },
    tobbi: true,
  },
  {
    id: 'V2',
    leiras: 'Options.env izolalt + jelolo, MCP env egy deklaralt valtozo',
    optionsEnvJelolo: true,
    mcpEnv: { DEKLARALT_VALTOZO: 'deklaralt' },
  },
  { id: 'V3', leiras: 'Options.env izolalt + jelolo, MCP env mezo nelkul', optionsEnvJelolo: true, mcpEnv: undefined },
  {
    id: 'V4',
    leiras: 'Options.env elhagyva (a CLI a process.env-et orokli, benne a jelolo), MCP env egy deklaralt valtozo',
    optionsEnvJelolo: 'elhagyva',
    mcpEnv: { DEKLARALT_VALTOZO: 'deklaralt' },
  },
  {
    id: 'V5',
    leiras: 'MCP env felulirja a HOME valtozot',
    optionsEnvJelolo: false,
    mcpEnv: { HOME: '/felulirt-home' },
  },
];

const SANDBOX = homedir();
const torol = (szoveg, home) =>
  typeof szoveg === 'string' ? szoveg.split(home).join('<home>').split(SANDBOX).join('<sandbox-home>') : szoveg;

for (const v of VALTOZATOK) {
  httpNaplo.length = 0;
  const kerdesek = [];
  const csonk = await inditCsonk(
    (body) => {
      const eszkozok = Array.isArray(body.tools) ? body.tools.map((t) => t.name) : [];
      const marVolt = JSON.stringify(body.messages ?? []).includes('tool_result');
      return eszkozok.includes('mcp__stdio-csonk__ping') && !marVolt
        ? { eszkoz: { name: 'mcp__stdio-csonk__ping', input: {} } }
        : {};
    },
    (b) => kerdesek.push(b),
  );
  const home = ujMunkakonyvtar(`m139-home-${v.id}`);
  const cwd = ujMunkakonyvtar(`m139-cwd-${v.id}`);
  const jelentes = path.join(home, 'stdio-kornyezet.json');
  const stdio = { type: 'stdio', command: process.execPath, args: [stdioScript, jelentes] };
  if (v.mcpEnv !== undefined) stdio.env = v.mcpEnv;
  const mcpServers = {
    'stdio-csonk': stdio,
    'http-csonk': { type: 'http', url: httpUrl, headers: { Authorization: AUTH } },
  };
  if (v.tobbi === true) {
    mcpServers['halott-http'] = { type: 'http', url: halottUrl };
    mcpServers['halott-stdio'] = { type: 'stdio', command: path.join(home, 'nem-letezo-parancs') };
  }
  const opciok = {
    cwd,
    settingSources: [],
    strictMcpConfig: true,
    maxTurns: 3,
    mcpServers,
    canUseTool: async (_n, input) => ({ behavior: 'allow', updatedInput: input }),
  };
  const izolalt = izoltKornyezet(csonk.url, home);
  const mentett = { ...process.env };
  if (v.optionsEnvJelolo === 'elhagyva') Object.assign(process.env, izolalt);
  else opciok.env = v.optionsEnvJelolo ? { ...izolalt, EASTER_PROBE_SECRET: JELOLO } : izolalt;
  const sor = {
    valtozat: v.id,
    leiras: v.leiras,
    cliPath: izolalt.PATH === process.env.PATH ? 'a szulo PATH-ja' : 'mas',
  };
  try {
    const q = sdk.query({ prompt: 'teszt', options: opciok });
    for await (const m of q) {
      if (m.type === 'system' && m.subtype === 'init') {
        sor.initMcp = m.mcp_servers;
        sor.initMcpEszkozok = m.tools.filter((t) => t.startsWith('mcp__'));
        sor.mcpServerStatus = (await q.mcpServerStatus()).map((s) => ({
          name: s.name,
          status: s.status,
          serverInfo: s.serverInfo,
          error: torol(s.error, home),
          config:
            s.config === undefined
              ? undefined
              : JSON.parse(
                  torol(JSON.stringify(s.config), home)
                    .split(ITT)
                    .join('<meresi-mappa>')
                    .split(process.execPath)
                    .join('<node>'),
                ),
          scope: s.scope,
          tools: s.tools?.map((t) => t.name),
        }));
      }
      if (m.type === 'result') sor.eredmeny = { subtype: m.subtype, is_error: m.is_error, num_turns: m.num_turns };
    }
  } catch (hiba) {
    sor.dobott = String(hiba instanceof Error ? hiba.message : hiba).slice(0, 400);
  }
  Object.keys(process.env).forEach((k) => {
    if (!(k in mentett)) delete process.env[k];
  });
  Object.assign(process.env, mentett);
  try {
    const kapott = JSON.parse(readFileSync(jelentes, 'utf8'));
    sor.stdioKornyezet = {
      nevek: kapott.nevek,
      ertekek: Object.fromEntries(Object.entries(kapott.ertekek).map(([k, e]) => [k, torol(e, home)])),
      pathEgyezikACliPathjaval: kapott.ertekek.PATH === izolalt.PATH,
    };
  } catch {
    sor.stdioKornyezet = 'nem keszult jelentes';
  }
  sor.httpMcpKeresek = [...httpNaplo];
  sor.modellKeresek = kerdesek.map((k) => ({
    utvonal: k.utvonal,
    valasz: k.valasz,
    mcpEszkozok: Array.isArray(k.body.tools)
      ? k.body.tools.map((t) => t.name).filter((n) => n.startsWith('mcp__'))
      : undefined,
    eszkozEredmeny: Array.isArray(k.body.messages)
      ? k.body.messages.flatMap((u) =>
          Array.isArray(u.content)
            ? u.content.filter((b) => b.type === 'tool_result').map((b) => JSON.stringify(b.content))
            : [],
        )
      : undefined,
  }));
  ki(sor);
  await csonk.zar();
}
await new Promise((r) => httpMcp.close(r));
