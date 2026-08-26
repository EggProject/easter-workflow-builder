/**
 * M-25: szerver oldali tool (web search) magasabb maxTurns mellett -- az
 * M-17 kiegészítése (nyitva maradt kérdés, kiértékelés 3. szekció 8. pont).
 * Az M-17 maxTurns: 3 mellett 8 kérés után error_max_turns-be futott, mielőtt
 * eldőlhetett volna, hogy a web_search folyamat ténylegesen lefutott-e
 * szerver oldalon. Ez a case magasabb korlátot ad, hogy a limit ne szakítsa
 * meg a folyamatot.
 */
import type { MeasurementCase } from '../harness/types.ts';
import { buildBaseOptions, executeQuery } from '../harness/runner.ts';

/**
Az M-17 nyolc kérés után elfogyott maxTurns: 3 mellett -- a case saját döntése alapján ez magasabb korlát.
*/
const HIGHER_MAX_TURNS = 12;

export const M25: MeasurementCase = {
  id: 'M-25',
  title: 'Szerver oldali tool magasabb maxTurns mellett',
  question: 'serverTools kiegészítés (nyitva maradt kérdés, kiértékelés 3. szekció 8. pont)',
  async run(context) {
    const outcome = await executeQuery({
      ctx: context,
      caseId: 'M-25',
      runId: 'a',
      prompt: 'Keress rá webes keresővel, hogy mennyi ma a Bitcoin árfolyama dollárban.',
      options: { ...buildBaseOptions(context), maxTurns: HIGHER_MAX_TURNS, allowedTools: ['WebSearch'] },
      timeoutMs: 120_000,
    });
    return [outcome];
  },
};
