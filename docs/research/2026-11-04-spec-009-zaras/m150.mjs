// M-150 (SPEC-009 O-47, 2026-11-04): a lépés skill listája az al-agentre is mérvadó, ha a `plugins`
// gyökér a lépés kiválasztott skilljeinek másolata. Esetek: (C1) szűkített gyökér, az al-agent a
// gyökéren kívüli skillt hívja; (C2) ugyanott a kiválasztott skillt; (C3) üres `skills/` mappájú
// gyökér, `skills: []`; (C4) `plugins` nélkül, `CLAUDE_CODE_DISABLE_BUNDLED_SKILLS=1` mellett az
// al-agent listázása. Futtatás: `node m150.mjs > m150-kimenet.jsonl`. Valódi API hívás nincs
// (helyi csonk, hamis kulcs; a 2026-10-28-i mérés segédjei).
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { inditCsonk } from '../2026-10-28-spec-009-blokkolo-meresek/csonk-messages-api.mjs';
import { betoltSdk, izoltKornyezet, ujMunkakonyvtar } from '../2026-10-28-spec-009-blokkolo-meresek/sdk-betolto.mjs';

const { sdk, verzio } = await betoltSdk();
const ki = (sor) => process.stdout.write(`${JSON.stringify(sor)}\n`);
ki({ meres: 'M-150', sdkVerzio: verzio, node: process.version });

const AL_AGENT_JELOLO = 'AL-AGENT-JELOLO-M150';

function gyoker(skillek) {
  // Manifeszt nélküli gyökér: a plugin neve a gyökér könyvtárneve (M-136 4a), mint a szerveren.
  const easter = path.join(ujMunkakonyvtar('m150-plugin'), 'easter-skills');
  mkdirSync(path.join(easter, 'skills'), { recursive: true });
  for (const nev of skillek) {
    const mappa = path.join(easter, 'skills', nev);
    mkdirSync(mappa, { recursive: true });
    writeFileSync(
      path.join(mappa, 'SKILL.md'),
      `---\nname: ${nev}\ndescription: Mérő skill a ${nev} könyvtárban.\n---\n\nTORZS-JELOLO-${nev}\n`,
    );
  }
  return easter;
}

const segito = (kiegeszites) => ({
  segito: {
    description: 'Mérő al-agent, minden feladatot ő végez.',
    prompt: `${AL_AGENT_JELOLO} Te a mérő al-agent vagy.`,
    ...kiegeszites,
  },
});

const csakBeta = gyoker(['beta']);
const ESETEK = [
  {
    id: 'C1',
    leiras: 'szukitett gyoker (csak beta), az al-agent a gyokeren kivuli alfa skillt hivja',
    plugins: [csakBeta],
    skills: ['easter-skills:beta'],
    agents: segito({ skills: ['easter-skills:beta'] }),
    subHivas: { name: 'Skill', input: { skill: 'easter-skills:alfa' } },
  },
  {
    id: 'C2',
    leiras: 'szukitett gyoker (csak beta), az al-agent a beta skillt hivja',
    plugins: [csakBeta],
    skills: ['easter-skills:beta'],
    agents: segito({ skills: ['easter-skills:beta'] }),
    subHivas: { name: 'Skill', input: { skill: 'easter-skills:beta' } },
  },
  {
    id: 'C3',
    leiras: 'ures skills mappaju gyoker, lepes skills ures lista',
    plugins: [gyoker([])],
    skills: [],
    agents: segito({}),
    subHivas: undefined,
  },
  {
    id: 'C4',
    leiras: 'plugins nelkul, beepitett skillek kikapcsolva, az al-agent listazasa',
    plugins: undefined,
    skills: undefined,
    env: { CLAUDE_CODE_DISABLE_BUNDLED_SKILLS: '1' },
    agents: segito({}),
    subHivas: { name: 'Skill', input: { skill: 'simplify' } },
  },
  {
    id: 'C5',
    leiras: 'kontroll a C4-hez: plugins nelkul, beepitett skillek bekapcsolva',
    plugins: undefined,
    skills: undefined,
    agents: segito({}),
    subHivas: { name: 'Skill', input: { skill: 'simplify' } },
  },
];

const eszkozNevek = (body) => (Array.isArray(body.tools) ? body.tools.map((t) => t.name) : []);
const alAgentKeres = (body) => JSON.stringify(body.system ?? '').includes(AL_AGENT_JELOLO);
const voltEredmeny = (body) => JSON.stringify(body.messages ?? []).includes('tool_result');
const eszkozEredmenyek = (body) =>
  (Array.isArray(body.messages) ? body.messages : []).flatMap((u) =>
    Array.isArray(u.content)
      ? u.content
          .filter((b) => b.type === 'tool_result')
          .map((b) => ({ is_error: b.is_error === true, tartalom: JSON.stringify(b.content).slice(0, 200) }))
      : [],
  );
const skillListazas = (body) =>
  JSON.stringify({ system: body.system, messages: body.messages })
    .split(/\\n/)
    .filter((s) => /^- [\w:.-]+: /.test(s))
    .map((s) => s.slice(0, 60).replaceAll('—', '-'));
const torzsJelolok = (body) => ['alfa', 'beta'].filter((n) => JSON.stringify(body).includes(`TORZS-JELOLO-${n}`));

for (const eset of ESETEK) {
  const kerdesek = [];
  const home = ujMunkakonyvtar(`m150-home-${eset.id}`);
  const csonk = await inditCsonk(
    (body) => {
      if (alAgentKeres(body)) {
        return eset.subHivas !== undefined && !voltEredmeny(body) ? { eszkoz: eset.subHivas } : {};
      }
      const agentEszkoz = eszkozNevek(body).find((n) => n === 'Agent' || n === 'Task');
      return agentEszkoz !== undefined && !voltEredmeny(body)
        ? {
            eszkoz: {
              name: agentEszkoz,
              input: {
                description: 'meres',
                prompt: 'Végezd el a mérést.',
                subagent_type: 'segito',
                run_in_background: false,
              },
            },
          }
        : {};
    },
    (b) => kerdesek.push(b),
  );
  const opciok = {
    cwd: ujMunkakonyvtar(`m150-cwd-${eset.id}`),
    env: { ...izoltKornyezet(csonk.url, home), ...eset.env },
    settingSources: [],
    strictMcpConfig: true,
    maxTurns: 4,
    agents: eset.agents,
    canUseTool: async (_nev, input) => ({ behavior: 'allow', updatedInput: input }),
  };
  if (eset.plugins !== undefined) opciok.plugins = eset.plugins.map((p) => ({ type: 'local', path: p }));
  if (eset.skills !== undefined) opciok.skills = eset.skills;
  const sor = {
    eset: eset.id,
    leiras: eset.leiras,
    lepesSkills: eset.skills ?? '(elhagyva)',
    subHivas: eset.subHivas?.input,
  };
  try {
    for await (const m of sdk.query({ prompt: 'teszt', options: opciok })) {
      if (m.type === 'system' && m.subtype === 'init') sor.initSkills = m.skills;
      if (m.type === 'result') sor.eredmeny = { subtype: m.subtype, is_error: m.is_error };
    }
  } catch (hiba) {
    sor.dobott = String(hiba instanceof Error ? hiba.message : hiba).slice(0, 300);
  }
  sor.kerdesek = kerdesek
    .filter((k) => k.metodus === 'POST')
    .map((k) => ({
      szal: alAgentKeres(k.body) ? 'al-agent' : 'fo',
      skillListazas: skillListazas(k.body),
      skillTorzs: torzsJelolok(k.body),
      eszkozEredmeny: eszkozEredmenyek(k.body),
    }));
  ki(sor);
  await csonk.zar();
}
