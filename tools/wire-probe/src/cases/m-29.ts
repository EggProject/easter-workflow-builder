/**
 * M-29: ANTHROPIC_DEFAULT_HAIKU_MODEL suffix NÉLKÜL, miközben a fő modell
 * (a felhasználó parancsában a sonnet/opus alias célja) [1m] suffixszel megy.
 * Az M-07/c ezt nem tudta szétválasztani, mert ott a fő modell is suffix
 * nélküli wire azonosító volt -- ha a háttér (thin) kérés a session modelljét
 * örökli, a két string ott megkülönböztethetetlen volt. Itt a fő modell
 * suffixes, a haiku env suffix nélküli, tehát a thin kérés `model` mezője
 * eldönti, hogy alias-feloldás történt-e.
 */
import type { MeasurementCase } from '../harness/types.ts';
import { buildBaseOptions, DEFAULT_PROMPT, executeQuery } from '../harness/runner.ts';
import { MINIMAX_CLIENT_MODEL, MINIMAX_WIRE_MODEL } from '../harness/minimax-model.ts';

export const M29: MeasurementCase = {
  id: 'M-29',
  title: 'ANTHROPIC_DEFAULT_HAIKU_MODEL suffix nélkül, sonnet/opus suffixszel',
  question:
    'user env: ANTHROPIC_DEFAULT_HAIKU_MODEL (suffix nélkül) vs ANTHROPIC_DEFAULT_SONNET_MODEL/ANTHROPIC_DEFAULT_OPUS_MODEL (suffixszel)',
  async run(context) {
    const base = buildBaseOptions(context);
    const outcome = await executeQuery({
      ctx: context,
      caseId: 'M-29',
      runId: 'a',
      prompt: DEFAULT_PROMPT,
      options: {
        ...base,
        model: MINIMAX_CLIENT_MODEL,
        env: {
          ...base.env,
          ANTHROPIC_DEFAULT_SONNET_MODEL: MINIMAX_CLIENT_MODEL,
          ANTHROPIC_DEFAULT_OPUS_MODEL: MINIMAX_CLIENT_MODEL,
          ANTHROPIC_DEFAULT_HAIKU_MODEL: MINIMAX_WIRE_MODEL,
        },
      },
    });
    return [outcome];
  },
};
