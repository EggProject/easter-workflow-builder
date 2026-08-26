// Minimalis Vite 8 dev/build config az e2e infrastruktura vazahoz
// (SPEC-001 10. szekcio). Az apps/web MEG NEM a tenyleges React
// alkalmazas - az egy kesobbi specifikacio targya (SPEC-001 1. szekcio,
// "Amit NEM dont el": "Nem tervez UI-t"). Ez a fajl csak annyit szolgal,
// hogy a Playwright `webServer`-nek legyen mit inditania, es a
// `vite-plugin-istanbul` instrumentalast valodi build/serve folyamaton
// lehessen kiprobalni.
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
import { defineConfig } from 'vite';
import istanbul from 'vite-plugin-istanbul';

export default defineConfig({
  plugins: [
    istanbul({
      include: 'src/*',
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
});
