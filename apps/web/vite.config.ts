// Vite 8 dev/build config a valodi React 19 alkalmazashoz (SPEC-007). Ez a
// fajl adja a Playwright `webServer`-nek inditando build/serve folyamatot,
// es a `vite-plugin-istanbul` instrumentalast az e2e lefedettseghez.
//
// A `vite-plugin-istanbul` Vite 8 (Rolldown) kompatibilitasa a SPEC-001
// szerint "nem igazolt" volt - EMPIRIKUSAN ELLENORIZVE ebben a feladatban,
// egy kulon, izolalt probaban: vite@8.2.2 + vite-plugin-istanbul@9.0.1,
// `vite build` sikeres (exit 0), es a kimeneti bundle-ben ténylegesen
// megjelenik a `window.__coverage__` inicializalas, ha
// `forceBuildInstrument: true`. Az npm `peerDependencies` bejegyzese
// `"vite": ">=7"` (felso korlat nelkul), a v9.0.0 valtozasnaploja csak
// ennyit rogzit: "bump vite peer dependency from >=4 to >=7"
// (https://github.com/iFaxity/vite-plugin-istanbul/releases/tag/v9.0.0) -
// explicit Vite 8 allitas a valtozasnaploban nincs, ezert kellett a sajat
// probafuttatas.
import { API_BASE_PATH } from '@easter-workflow-builder/protocol';
import { defineConfig, loadEnv } from 'vite';
import istanbul from 'vite-plugin-istanbul';

// A fejlesztoi proxy dontes (SPEC-008 3. szekcio). A REST hivas a Vite dev
// szerver sajat originjere megy (VITE_API_ORIGIN), a szerver pedig az
// `API_BASE_PATH` elotagu kereseket a tenyleges backendre tovabbitja. A
// tovabbitas celja UGYANAZ a VITE_STREAM_ORIGIN ertek, amit fejlesztéskor az
// SSE csatorna is hasznal (az kozvetlenul, a proxyt megkerulve kapcsolodik
// ra) - tehat nem uj env valtozo, hanem a mar letezo kliens config
// ujrahasznositasa. A `timeout` mezot SZANDEKOSAN nem allitjuk be: az M-79
// meres szerint nincs ket fuggetlen forras az ertekere (docs/research/
// 2026-09-05-grafszerkeszto-es-transcript.md 2.4 szekcio).
export default defineConfig(({ mode }) => {
  const environment = loadEnv(mode, process.cwd(), '');
  return {
    server: {
      proxy: {
        [API_BASE_PATH]: environment['VITE_STREAM_ORIGIN'],
      },
    },
    plugins: [
      istanbul({
        // A `src/*` mintázat csak a `src/` közvetlen fájljait fedte volna,
        // a téma mappák alá süllyesztett komponenseket nem (SPEC-002 6.
        // mappaszerkezet): a `src/**/*` az egész forrásfát fedi, a
        // regressziót a `vite-istanbul-include-invariant` téma őrzi
        // (T-008-18).
        include: 'src/**/*',
        exclude: ['node_modules', 'e2e/**'],
        // A dev szerver es a normal production build alapertelmezesben NEM
        // instrumentalt - csak akkor, ha a VITE_COVERAGE=true env valtozo
        // explicit be van allitva (az e2e webServer parancsa allitja be,
        // lasd playwright.config.ts). Forras: a plugin README "requireEnv"
        // opcioja.
        requireEnv: true,
        // A plugin alapertelmezesben CSAK dev szerver modban instrumental,
        // `vite build`-nel nem (a README szerint a `forceBuildInstrument`
        // alapertelmezese `false`). Az e2e teszt egy `vite build` + `vite
        // preview` pár ellen fut, tehat build modban is instrumentalni kell.
        forceBuildInstrument: true,
      }),
    ],
    build: {
      // A plugin README kifejezetten megkoveteli: "requires the Vite
      // configuration build.sourcemap to be set to either true, 'inline',
      // or 'hidden'" a pontos lefedettsegi terkephez.
      sourcemap: true,
    },
  };
});
