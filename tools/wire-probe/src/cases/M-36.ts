/**
 * M-36: rate limit header leltár -- passzív elemzés, az M-18 mintájára, az
 * M-26 ... M-35 mérési kör összes artefaktumából. Nem indít saját kérést.
 */
import type { MeasurementCase } from '../harness/types.ts';

export const M36: MeasurementCase = {
  id: 'M-36',
  title: 'Rate limit header leltár (M-26 ... M-35 kör)',
  question: 'rateLimits.retryAfterHeader, rateLimits.rateLimitHeaders (nyitva maradt capability mezők) -- passzív elemzés',
  async run() {
    return [
      {
        runId: 'passive',
        ok: true,
        note:
          'M-36 nem indít saját kérést -- futtasd a summary.ts-t vagy elemezd kézzel az artifacts/*.json response headereit az M-26 ... M-35 kör tranzakcióira.',
      },
    ];
  },
};
