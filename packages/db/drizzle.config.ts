import { defineConfig } from 'drizzle-kit';

/**
 * Explicit fájllista, nem glob. A `./src/**\/*.ts` glob az elszigetelt
 * próbában (docs/research/2026-08-27-spec003-f1-nyitott-kerdesek.md, O-8
 * szekció) még minden téma mappa tábláját felszedte, a valódi csomagban
 * viszont a `.spec.ts` fájlok `vitest` importja miatt a drizzle-kit esbuild
 * alapú CJS bundlere elhasal ("Vitest cannot be imported in a CommonJS
 * module using require()"), és a `!./src/**\/*.spec.ts` negációs minta ezt
 * nem szűri ki (a hivatalos drizzle.config.ts doksi `schema` szekciója sem
 * dokumentál negációs mintát, csak összegző vagy elem szerinti listát:
 * https://orm.drizzle.team/docs/drizzle-config-file#schema). Ezért a tábla
 * fájlokat egyenként, explicit útvonalon soroljuk fel; új téma mappa új
 * tábla fájlja esetén ide is fel kell venni.
 */
export default defineConfig({
  dialect: 'sqlite',
  schema: [
    './src/workflow-graph/workflow.ts',
    './src/workflow-graph/workflow-node.ts',
    './src/workflow-graph/workflow-edge.ts',
    './src/graph-snapshot/graph-snapshot.ts',
    './src/workflow-run/workflow-run.ts',
    './src/step-run/step-run.ts',
    './src/app-setting/app-setting.ts',
    './src/provider-concurrency/provider-concurrency.ts',
    './src/run-event/run-event.ts',
    './src/human-approval/human-approval.ts',
  ],
  out: './drizzle',
});
