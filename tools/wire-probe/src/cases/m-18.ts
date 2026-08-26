/**
 * M-18: hiba és rate limit header leltár -- passzív elemzés.
 * Nem indít saját kérést: a proxy `artifacts/` könyvtárában rögzített összes
 * korábbi tranzakció utólagos elemzése, lásd `src/summary.ts`.
 */
import type { MeasurementCase } from '../harness/types.ts';

export const M18: MeasurementCase = {
  id: 'M-18',
  title: 'Hiba és rate limit header leltár',
  question: 'rateLimits (descriptor kiegészítő mező) -- passzív elemzés az összes korábbi eset artefaktumából',
  run() {
    return Promise.resolve([
      {
        runId: 'passive',
        ok: true,
        note: 'M-18 nem indít saját kérést -- futtasd a summary.ts-t az összes korábbi proxy tranzakció headerkészletének és hibaválaszainak elemzéséhez.',
      },
    ]);
  },
};
