// M-147 (PLAN-012 T-012-22, T-012-23 előtt): az agent definíció (`Options.agents`) `skills` és
// `mcpServers` mezője. (a) Milyen név alakot fogad az agent definíció `skills` listája, és kell-e
// hozzá a lépés szintű `plugins`; (b) az `AgentMcpServerSpec` szöveg ága a lépés `mcpServers`
// kulcsaira oldódik-e, és mit lát az al-agent a szülő szervereiből.
// Futtatás: `node m147.mjs > m147-kimenet.jsonl`. Valódi API hívás nincs (helyi csonk, hamis kulcs).
import { mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { inditCsonk } from './csonk-messages-api.mjs';
import { betoltSdk, izoltKornyezet, ujMunkakonyvtar } from './sdk-betolto.mjs';

const ITT = path.dirname(fileURLToPath(import.meta.url));
const { sdk, verzio } = await betoltSdk();
const ki = (sor) => process.stdout.write(`${JSON.stringify(sor)}\n`);
ki({ meres: 'M-147', sdkVerzio: verzio, node: process.version });

// Az al-agent rendszer promptjának jelölője: a csonk erről ismeri fel az al-agent kéréseit.
const AL_AGENT_JELOLO = 'AL-AGENT-JELOLO-M147';

function plugin(gyoker, manifesztNev, skillek) {
  mkdirSync(gyoker, { recursive: true });
  if (manifesztNev !== undefined) {
    mkdirSync(path.join(gyoker, '.claude-plugin'), { recursive: true });
    writeFileSync(path.join(gyoker, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: manifesztNev }));
  }
  for (const konyvtar of skillek) {
    const mappa = path.join(gyoker, 'skills', konyvtar);
    mkdirSync(mappa, { recursive: true });
    writeFileSync(
      path.join(mappa, 'SKILL.md'),
      `---\nname: ${konyvtar}\ndescription: Mérő skill a ${konyvtar} könyvtárban.\n---\n\nTORZS-JELOLO-${konyvtar}\n`,
    );
  }
}

const alap = ujMunkakonyvtar('m147-pluginok');
// Manifeszt nélküli gyökér: a plugin neve a gyökér könyvtárneve, ahogy a szerver is használja (M-136 4a).
const easter = path.join(alap, 'easter-skills');
plugin(easter, undefined, ['alfa', 'beta']);
const utkozo = path.join(alap, 'utkozo');
plugin(utkozo, undefined, ['simplify']);

const stdioScript = path.join(ITT, 'mcp-stdio-csonk.mjs');
// A `jelentes` a csonk indításkor írt környezet fájljának neve: ebből látszik, melyik konfiguráció indult el.
const stdioSzerver = (home, jelentes) => ({
  type: 'stdio',
  command: process.execPath,
  args: [stdioScript, path.join(home, `${jelentes}-kornyezet.json`), jelentes],
});

const segito = (kiegeszites) => ({
  segito: {
    description: 'Mérő al-agent, minden feladatot ő végez.',
    prompt: `${AL_AGENT_JELOLO} Te a mérő al-agent vagy.`,
    ...kiegeszites,
  },
});

// Minden esetben a fő szál egyszer delegál a `segito` al-agentnek; az al-agent (ha az eset
// megadja) egyszer meghívja a `subHivas` eszközt, utána szöveggel zár.
const ESETEK = (home) => [
  {
    id: 'A1',
    leiras: 'agent skills teljes alak, lepes plugins, lepes skills elhagyva',
    plugins: [easter],
    skills: undefined,
    agents: segito({ skills: ['easter-skills:alfa'] }),
    subHivas: { name: 'Skill', input: { skill: 'easter-skills:alfa' } },
  },
  {
    id: 'A2',
    leiras: 'agent skills puszta alak, lepes plugins',
    plugins: [easter],
    skills: undefined,
    agents: segito({ skills: ['alfa'] }),
    subHivas: { name: 'Skill', input: { skill: 'easter-skills:alfa' } },
  },
  {
    id: 'A3',
    leiras: 'agent skills teljes alak, lepes plugins nelkul',
    plugins: [],
    skills: undefined,
    agents: segito({ skills: ['easter-skills:alfa'] }),
    subHivas: { name: 'Skill', input: { skill: 'easter-skills:alfa' } },
  },
  {
    id: 'A4',
    leiras: 'agent skills teljes alak, lepes plugins, lepes skills ures lista',
    plugins: [easter],
    skills: [],
    agents: segito({ skills: ['easter-skills:alfa'] }),
    subHivas: { name: 'Skill', input: { skill: 'easter-skills:alfa' } },
  },
  {
    id: 'A5',
    leiras: 'agent skills teljes alak, lepes skills csak a masik skill',
    plugins: [easter],
    skills: ['easter-skills:beta'],
    agents: segito({ skills: ['easter-skills:alfa'] }),
    subHivas: { name: 'Skill', input: { skill: 'easter-skills:alfa' } },
  },
  {
    id: 'A6',
    leiras: 'agent skills nem letezo nev',
    plugins: [easter],
    skills: undefined,
    agents: segito({ skills: ['easter-skills:nincs-ilyen'] }),
    subHivas: undefined,
  },
  {
    id: 'A7',
    leiras: 'agent skills ervenytelen alak (vesszo)',
    plugins: [easter],
    skills: undefined,
    agents: segito({ skills: ['rossz,nev'] }),
    subHivas: undefined,
  },
  {
    id: 'A8',
    leiras: 'agent skills beepitettel azonos puszta nev',
    plugins: [utkozo],
    skills: undefined,
    agents: segito({ skills: ['simplify'] }),
    subHivas: undefined,
  },
  {
    id: 'B1',
    leiras: 'agent mcpServers szoveg, a lepes mcpServers kulcsa',
    mcpServers: { 'lepes-csonk': stdioSzerver(home, 'lepes-csonk') },
    agents: segito({ mcpServers: ['lepes-csonk'] }),
    subHivas: { name: 'mcp__lepes-csonk__ping', input: {} },
  },
  {
    id: 'B2',
    leiras: 'agent mcpServers szoveg, a lepesen nincs ilyen szerver',
    mcpServers: undefined,
    agents: segito({ mcpServers: ['lepes-csonk'] }),
    subHivas: { name: 'mcp__lepes-csonk__ping', input: {} },
  },
  {
    id: 'B3',
    leiras: 'agent mcpServers objektum (sajat szerver), a lepesen nincs szerver',
    mcpServers: undefined,
    agents: segito({ mcpServers: [{ 'agent-csonk': stdioSzerver(home, 'agent-csonk') }] }),
    subHivas: { name: 'mcp__agent-csonk__ping', input: {} },
  },
  {
    id: 'B4',
    leiras: 'agent mcpServers nelkul, a lepesen egy szerver (oroklodes)',
    mcpServers: { 'lepes-csonk': stdioSzerver(home, 'lepes-csonk') },
    agents: segito({}),
    subHivas: { name: 'mcp__lepes-csonk__ping', input: {} },
  },
  {
    id: 'B5',
    leiras: 'agent mcpServers egy masik szerverre, a lepesen ket szerver',
    mcpServers: {
      'lepes-csonk': stdioSzerver(home, 'lepes-csonk'),
      'masik-csonk': stdioSzerver(home, 'masik-csonk'),
    },
    agents: segito({ mcpServers: ['masik-csonk'] }),
    subHivas: { name: 'mcp__lepes-csonk__ping', input: {} },
  },
  {
    id: 'B6',
    leiras: 'agent mcpServers objektum a lepes szerverevel azonos nevvel, mas konfiguracioval',
    mcpServers: { 'lepes-csonk': stdioSzerver(home, 'lepes-konfiguracio') },
    agents: segito({ mcpServers: [{ 'lepes-csonk': stdioSzerver(home, 'agent-konfiguracio') }] }),
    subHivas: { name: 'mcp__lepes-csonk__ping', input: {} },
  },
];

const eszkozNevek = (body) => (Array.isArray(body.tools) ? body.tools.map((t) => t.name) : []);
const alAgentKeres = (body) => JSON.stringify(body.system ?? '').includes(AL_AGENT_JELOLO);
const voltEredmeny = (body) => JSON.stringify(body.messages ?? []).includes('tool_result');

function eszkozEredmenyek(body) {
  const uzenetek = Array.isArray(body.messages) ? body.messages : [];
  return uzenetek.flatMap((u) =>
    Array.isArray(u.content)
      ? u.content
          .filter((b) => b.type === 'tool_result')
          .map((b) => ({ is_error: b.is_error === true, tartalom: JSON.stringify(b.content).slice(0, 300) }))
      : [],
  );
}

function skillListazas(body) {
  return JSON.stringify({ system: body.system, messages: body.messages })
    .split(/\\n/)
    .filter((s) => /^- [\w:.-]+: /.test(s))
    .map((s) => s.slice(0, 100).replaceAll('—', '-'));
}

const torzsJelolok = (body) =>
  ['alfa', 'beta', 'simplify', 'nincs-ilyen'].filter((n) => JSON.stringify(body).includes(`TORZS-JELOLO-${n}`));

for (const eset of ESETEK(ujMunkakonyvtar('m147-home-sablon'))) {
  const kerdesek = [];
  const home = ujMunkakonyvtar(`m147-home-${eset.id}`);
  const esetek = ESETEK(home);
  const aktualis = esetek.find((e) => e.id === eset.id);
  const csonk = await inditCsonk(
    (body) => {
      const eszkozok = eszkozNevek(body);
      if (alAgentKeres(body)) {
        return aktualis.subHivas !== undefined && !voltEredmeny(body) ? { eszkoz: aktualis.subHivas } : {};
      }
      const agentEszkoz = eszkozok.find((n) => n === 'Agent' || n === 'Task');
      return agentEszkoz !== undefined && !voltEredmeny(body)
        ? {
            eszkoz: {
              name: agentEszkoz,
              input: {
                description: 'meres',
                prompt: 'Végezd el a mérést.',
                subagent_type: 'segito',
                // A fő szál megvárja az al-agentet, így az al-agent eszköz engedélye még nyitott folyamon fut.
                run_in_background: false,
              },
            },
          }
        : {};
    },
    (b) => kerdesek.push(b),
  );
  const cwd = ujMunkakonyvtar(`m147-cwd-${eset.id}`);
  const opciok = {
    cwd,
    env: izoltKornyezet(csonk.url, home),
    settingSources: [],
    strictMcpConfig: true,
    maxTurns: 4,
    agents: aktualis.agents,
    canUseTool: async (_nev, input) => ({ behavior: 'allow', updatedInput: input }),
  };
  if (aktualis.plugins !== undefined) opciok.plugins = aktualis.plugins.map((p) => ({ type: 'local', path: p }));
  if (aktualis.skills !== undefined) opciok.skills = aktualis.skills;
  if (aktualis.mcpServers !== undefined) opciok.mcpServers = aktualis.mcpServers;
  const sor = {
    eset: aktualis.id,
    leiras: aktualis.leiras,
    lepesSkills: aktualis.skills ?? '(elhagyva)',
    lepesPlugins: (aktualis.plugins ?? []).map((p) => path.basename(p)),
    lepesMcp: Object.keys(aktualis.mcpServers ?? {}),
    agentSkills: aktualis.agents.segito.skills,
    agentMcp: aktualis.agents.segito.mcpServers?.map((s) => (typeof s === 'string' ? s : Object.keys(s))),
    subHivas: aktualis.subHivas?.name,
  };
  try {
    const q = sdk.query({ prompt: 'teszt', options: opciok });
    for await (const m of q) {
      if (m.type === 'system' && m.subtype === 'init') {
        sor.init = {
          agents: m.agents,
          skills: m.skills.filter((s) => s.includes(':') || s === 'simplify'),
          mcpServers: m.mcp_servers,
          claudeCodeVerzio: m.claude_code_version,
        };
      }
      if (m.type === 'result') sor.eredmeny = { subtype: m.subtype, is_error: m.is_error, num_turns: m.num_turns };
    }
  } catch (hiba) {
    sor.dobott = String(hiba instanceof Error ? hiba.message : hiba)
      .slice(0, 400)
      .replaceAll('—', '-');
  }
  sor.kerdesek = kerdesek
    .filter((k) => k.metodus === 'POST')
    .map((k) => ({
      szal: alAgentKeres(k.body) ? 'al-agent' : 'fo',
      valasz: k.valasz,
      eszkozok: eszkozNevek(k.body).filter(
        (n) => n === 'Skill' || n === 'Agent' || n === 'Task' || n.startsWith('mcp__'),
      ),
      skillListazas: skillListazas(k.body),
      skillTorzs: torzsJelolok(k.body),
      eszkozEredmeny: eszkozEredmenyek(k.body),
    }));
  // A stdio csonkok indításkor írt jelentés fájljai: melyik konfiguráció indult el ténylegesen.
  sor.elindultStdioKonfiguraciok = readdirSync(home)
    .filter((f) => f.endsWith('-kornyezet.json'))
    .map((f) => f.replace('-kornyezet.json', ''))
    .sort();
  ki(sor);
  await csonk.zar();
}
