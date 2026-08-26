/**
 * M-32: a felhasználó teljes indító parancsának env változói egyszerre --
 * referencia futás. A `model` mezőt SZÁNDÉKOSAN nem állítjuk be az
 * Options-ban (a felhasználó parancsában sincs --model flag, csak
 * ANTHROPIC_MODEL env), hogy a kliens env-alapú modellfeloldása mérhető
 * legyen, ne az Options.model írja felül (a hivatalos leírás szerint
 * "--model és /model felülírja az ANTHROPIC_MODEL-t", tehát fordítva: env
 * nélküli Options.model esetén az ANTHROPIC_MODEL dönt).
 *
 * A Coding Plan tokent nem kapjuk meg -- ANTHROPIC_AUTH_TOKEN helyett a
 * proxyn átmenő .env-beli MINIMAX_API_KEY megy ki, ez a SPEC-000 4. szekció
 * "Közös alapbeállítás" szerint elfogadott, mert a mért env hatások
 * kliens oldaliak.
 */
import type { MeasurementCase } from '../harness/types.ts';
import { buildBaseOptions, DEFAULT_PROMPT, executeQuery } from '../harness/runner.ts';

export const M32: MeasurementCase = {
  id: 'M-32',
  title: 'A teljes felhasználói parancs env változói együtt',
  question: 'user env: mind a 12 változó egyszerre, referencia body',
  async run(ctx) {
    const base = buildBaseOptions(ctx);
    const { model: _unusedBaseModel, ...baseWithoutModel } = base;
    const outcome = await executeQuery({
      ctx,
      caseId: 'M-32',
      runId: 'a',
      prompt: DEFAULT_PROMPT,
      options: {
        ...baseWithoutModel,
        env: {
          ...base.env,
          API_TIMEOUT_MS: '3000000',
          CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC: '1',
          ANTHROPIC_MODEL: 'MiniMax-M3[1m]',
          ANTHROPIC_DEFAULT_SONNET_MODEL: 'MiniMax-M3[1m]',
          ANTHROPIC_DEFAULT_OPUS_MODEL: 'MiniMax-M3[1m]',
          ANTHROPIC_DEFAULT_HAIKU_MODEL: 'MiniMax-M3',
          CLAUDE_CODE_AUTO_COMPACT_WINDOW: '1000000',
          CLAUDE_CODE_ALWAYS_ENABLE_EFFORT: '1',
          CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: '50',
          CLAUDE_CODE_DISABLE_FAST_MODE: '1',
          CLAUDE_CODE_MAX_CONCURRENT_SUBAGENTS: '3',
        },
      },
    });
    return [outcome];
  },
};
