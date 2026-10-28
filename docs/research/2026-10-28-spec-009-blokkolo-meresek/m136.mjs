// M-136 (SPEC-009 4. szekció): a `plugins` úton betöltött skill neve és elérhetősége
// `settingSources: []` mellett. Futtatás: `node m136.mjs > m136-kimenet.jsonl`.
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { inditCsonk } from './csonk-messages-api.mjs';
import { betoltSdk, izoltKornyezet, ujMunkakonyvtar } from './sdk-betolto.mjs';

const { sdk, verzio } = await betoltSdk();
const ki = (sor) => process.stdout.write(`${JSON.stringify(sor)}\n`);
ki({ meres: 'M-136', sdkVerzio: verzio, node: process.version });

// Plugin gyökerek: `<gyökér>/skills/<könyvtárnév>/SKILL.md`.
function plugin(gyoker, manifesztNev, skillek) {
  mkdirSync(gyoker, { recursive: true });
  if (manifesztNev !== undefined) {
    mkdirSync(path.join(gyoker, '.claude-plugin'), { recursive: true });
    writeFileSync(path.join(gyoker, '.claude-plugin', 'plugin.json'), JSON.stringify({ name: manifesztNev }));
  }
  for (const { konyvtar, frontmatterNev } of skillek) {
    const mappa = path.join(gyoker, 'skills', konyvtar);
    mkdirSync(mappa, { recursive: true });
    writeFileSync(
      path.join(mappa, 'SKILL.md'),
      `---\n${frontmatterNev === undefined ? '' : `name: ${frontmatterNev}\n`}description: Mérő skill a ${konyvtar} könyvtárban.\n---\n\nJELOLO-${konyvtar}\n`,
    );
  }
}

const alap = ujMunkakonyvtar('m136-pluginok');
const manifeszttel = path.join(alap, 'manifeszt-mappa');
plugin(manifeszttel, 'easter-skills', [
  { konyvtar: 'alfa', frontmatterNev: 'alfa' },
  { konyvtar: 'beta', frontmatterNev: 'gamma-mas' },
]);
const manifesztNelkul = path.join(alap, 'manifeszt-nelkuli-mappa');
plugin(manifesztNelkul, undefined, [{ konyvtar: 'delta', frontmatterNev: 'delta' }]);
// A CLI beépített skilljével azonos könyvtárnév, és egy `name` mező nélküli frontmatter.
const utkozo = path.join(alap, 'utkozo-mappa');
plugin(utkozo, 'utkozo', [
  { konyvtar: 'simplify', frontmatterNev: 'simplify' },
  { konyvtar: 'nevtelen', frontmatterNev: undefined },
]);

const ESETEK = [
  {
    id: '1a',
    leiras: 'egyezo nev, teljes alak',
    plugins: [manifeszttel],
    skills: ['easter-skills:alfa'],
    hivas: 'easter-skills:alfa',
  },
  {
    id: '1b',
    leiras: 'egyezo nev, puszta alak',
    plugins: [manifeszttel],
    skills: ['alfa'],
    hivas: 'easter-skills:alfa',
  },
  {
    id: '1c',
    leiras: 'egyezo nev, puszta alak, puszta hivas',
    plugins: [manifeszttel],
    skills: ['alfa'],
    hivas: 'alfa',
  },
  {
    id: '2a',
    leiras: 'elteres, konyvtarnev a listan',
    plugins: [manifeszttel],
    skills: ['easter-skills:beta'],
    hivas: 'easter-skills:beta',
  },
  {
    id: '2b',
    leiras: 'elteres, frontmatter nev a listan',
    plugins: [manifeszttel],
    skills: ['easter-skills:gamma-mas'],
    hivas: 'easter-skills:gamma-mas',
  },
  {
    id: '2c',
    leiras: 'elteres, all, frontmatter nevu hivas',
    plugins: [manifeszttel],
    skills: 'all',
    hivas: 'easter-skills:gamma-mas',
  },
  {
    id: '2d',
    leiras: 'elteres, all, konyvtarnevu hivas',
    plugins: [manifeszttel],
    skills: 'all',
    hivas: 'easter-skills:beta',
  },
  {
    id: '3a',
    leiras: 'skills elhagyva, plugins megadva',
    plugins: [manifeszttel],
    skills: undefined,
    hivas: 'easter-skills:alfa',
  },
  { id: '3b', leiras: 'sem skills, sem plugins', plugins: [], skills: undefined, hivas: 'easter-skills:alfa' },
  {
    id: '4a',
    leiras: 'manifeszt nelkuli plugin, all',
    plugins: [manifesztNelkul],
    skills: 'all',
    hivas: 'manifeszt-nelkuli-mappa:delta',
  },
  {
    id: '4b',
    leiras: 'manifeszt nelkuli plugin, lista',
    plugins: [manifesztNelkul],
    skills: ['manifeszt-nelkuli-mappa:delta'],
    hivas: 'manifeszt-nelkuli-mappa:delta',
  },
  { id: '1d', leiras: 'ures lista', plugins: [manifeszttel], skills: [], hivas: 'easter-skills:alfa' },
  {
    id: '2e',
    leiras: 'elteres, puszta frontmatter nev a listan',
    plugins: [manifeszttel],
    skills: ['gamma-mas'],
    hivas: 'gamma-mas',
  },
  {
    id: '2f',
    leiras: 'elteres, puszta konyvtarnev a listan',
    plugins: [manifeszttel],
    skills: ['beta'],
    hivas: 'beta',
  },
  {
    id: '5b',
    leiras: 'ervenytelen alaku nev (vesszo)',
    plugins: [manifeszttel],
    skills: ['rossz,nev'],
    hivas: 'easter-skills:alfa',
  },
  {
    id: '6a',
    leiras: 'beepitettel azonos puszta nev a listan',
    plugins: [utkozo],
    skills: ['simplify'],
    hivas: 'simplify',
  },
  {
    id: '6b',
    leiras: 'beepitettel azonos nev, teljes alak',
    plugins: [utkozo],
    skills: ['utkozo:simplify'],
    hivas: 'utkozo:simplify',
  },
  {
    id: '7a',
    leiras: 'name mezo nelkuli frontmatter',
    plugins: [utkozo],
    skills: ['utkozo:nevtelen'],
    hivas: 'utkozo:nevtelen',
  },
  {
    id: '8a',
    leiras: 'relativ plugin utvonal (a cwd-hez kepest)',
    plugins: ['RELATIV'],
    skills: ['easter-skills:alfa'],
    hivas: 'easter-skills:alfa',
  },
  {
    id: '5a',
    leiras: 'nem letezo nev a listan',
    plugins: [manifeszttel],
    skills: ['easter-skills:nincs-ilyen'],
    hivas: 'easter-skills:nincs-ilyen',
  },
];

const KERESETT = ['alfa', 'beta', 'gamma-mas', 'delta', 'easter-skills', 'manifeszt-nelkuli-mappa', 'nincs-ilyen'];

// A kérés törzséből a modellnek szóló skill listázás sorai (`- <név>: <leírás>` alak).
function skillListazas(body) {
  const sorok = JSON.stringify(body).split(/\\n/);
  return sorok.filter((s) => /^- [\w:.-]+: /.test(s)).map((s) => s.slice(0, 120).replaceAll('\u2014', '-'));
}

function eszkozEredmeny(body) {
  const uzenetek = Array.isArray(body.messages) ? body.messages : [];
  const talalat = [];
  for (const u of uzenetek) {
    if (!Array.isArray(u.content)) continue;
    for (const b of u.content) {
      if (b.type === 'tool_result')
        talalat.push({ is_error: b.is_error === true, tartalom: JSON.stringify(b.content).slice(0, 400) });
    }
  }
  return talalat;
}

for (const eset of ESETEK) {
  const kerdesek = [];
  const csonk = await inditCsonk(
    (body) => {
      const eszkozok = Array.isArray(body.tools) ? body.tools.map((t) => t.name) : [];
      const marVolt = eszkozEredmeny(body).length > 0;
      return eszkozok.includes('Skill') && !marVolt ? { eszkoz: { name: 'Skill', input: { skill: eset.hivas } } } : {};
    },
    (b) => kerdesek.push(b),
  );
  const home = ujMunkakonyvtar(`m136-home-${eset.id}`);
  const cwd = ujMunkakonyvtar(`m136-cwd-${eset.id}`);
  const opciok = {
    cwd,
    env: izoltKornyezet(csonk.url, home),
    settingSources: [],
    strictMcpConfig: true,
    maxTurns: 3,
    plugins: eset.plugins.map((p) => ({ type: 'local', path: p === 'RELATIV' ? path.relative(cwd, manifeszttel) : p })),
    canUseTool: async (_nev, input) => ({ behavior: 'allow', updatedInput: input }),
  };
  if (eset.skills !== undefined) opciok.skills = eset.skills;
  const sor = { eset: eset.id, leiras: eset.leiras, skillsOpcio: eset.skills ?? '(elhagyva)', hivas: eset.hivas };
  try {
    const q = sdk.query({ prompt: 'teszt', options: opciok });
    for await (const m of q) {
      if (m.type === 'system' && m.subtype === 'init') {
        sor.init = {
          skills: m.skills,
          claudeCodeVerzio: m.claude_code_version,
          plugins: m.plugins.map((p) => ({ name: p.name, path: p.path.replace(alap, '<pluginok>') })),
          skillEszkoz: m.tools.includes('Skill'),
          slashSkill: m.slash_commands.filter((c) => KERESETT.some((k) => c.includes(k))),
          apiKeySource: m.apiKeySource,
        };
      }
      if (m.type === 'result') sor.eredmeny = { subtype: m.subtype, is_error: m.is_error, num_turns: m.num_turns };
    }
  } catch (hiba) {
    sor.dobott = String(hiba instanceof Error ? hiba.message : hiba).slice(0, 400);
  }
  sor.kerdesek = kerdesek.map((k) => ({
    metodus: k.metodus,
    utvonal: k.utvonal,
    valasz: k.valasz,
    eszkozok: Array.isArray(k.body.tools) ? k.body.tools.map((t) => t.name) : undefined,
    skillListazas:
      k.body.messages === undefined ? undefined : skillListazas({ system: k.body.system, messages: k.body.messages }),
    eszkozEredmeny: k.body.messages === undefined ? undefined : eszkozEredmeny(k.body),
  }));
  ki(sor);
  await csonk.zar();
}
