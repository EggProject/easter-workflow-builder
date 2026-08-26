// A Vitest `json-summary` riportjabol GitHub Flavored Markdown tablazatot ir a
// szabvanyos kimenetre. A hivo lepes ket helyre iranyitja: a job summary
// fajlba (`$GITHUB_STEP_SUMMARY`) es a PR komment testet osszerako fajlba.
//
// A bemeneti fajlt a gyoker `vitest.config.ts` `coverage.reporter` listajanak
// `json-summary` eleme allitja elo, a `coverage/` konyvtarba.
//
// A job summary GitHub Flavored Markdownt fogad ("Job summaries support GitHub
// flavored Markdown, and you can add your Markdown content for a step to the
// GITHUB_STEP_SUMMARY environment file"), lepesenkent legfeljebb 1 MiB meretig -
// egy negysoros tablazat ettol nagysagrendekkel elmarad.
// Forras: https://docs.github.com/en/actions/reference/workflows-and-actions/workflow-commands
//
// Ez a fajl szandekosan `.mjs` es nem `.ts`: a `.github/` fa nem workspace
// csomag, tehat sem a `typecheck`, sem a `lint` task nem eri el, es nem is
// kellene erte kulon tsconfig-ot felvenni. A Prettier viszont formazza.
import { readFileSync } from 'node:fs';

const SUMMARY_PATH = 'coverage/coverage-summary.json';

// A Vitest `thresholds[100]` kapcsoloja pontosan ezt a negy metrikat allitja
// 100 szazalekra, ezert a tablazat is ezt a negyet mutatja.
// Forras: https://vitest.dev/config/coverage
const METRICS = ['lines', 'statements', 'functions', 'branches'];

const HEADING = '### Unit coverage (Vitest, v8 provider)';

let raw;
try {
  raw = readFileSync(SUMMARY_PATH, 'utf8');
} catch {
  // A riport hianya nem hiba ebben a scriptben: a hivo lepes `if: always()`
  // mellett fut, tehat akkor is meghivodik, ha a Vitest a tesztek elinditasa
  // elott omlott ossze. Ilyenkor a job summary ezt mondja ki, es a jobot a
  // `test` lepes sajat kilepesi kodja bukatja el, nem ez.
  process.stdout.write(`${HEADING}\n\nNincs riport: a \`${SUMMARY_PATH}\` nem keszult el.\n`);
  process.exit(0);
}

const { total } = JSON.parse(raw);

const rows = METRICS.map((metric) => {
  const entry = total[metric];
  return `| ${metric} | ${entry.covered} / ${entry.total} | ${entry.pct}% |`;
});

process.stdout.write(
  [
    HEADING,
    '',
    '| Metrika | Fedett / összes | Százalék |',
    '| --- | --- | --- |',
    ...rows,
    '',
    'A küszöböt maga a Vitest kényszeríti ki (`vitest.config.ts`, `coverage.thresholds[100]`),',
    'ezért ha ez a job zöld, a küszöb teljesült. A böngészhető HTML riport a futás',
    '`coverage-report` artefaktumában van.',
    '',
  ].join('\n'),
);
