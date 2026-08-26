/**
M-13: kontextusablak és auto-compact -- Q11.
*/
import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import type { MeasurementCase } from '../harness/types.ts';
import { buildBaseOptions, executeQuery } from '../harness/runner.ts';

/**
 * Nagy, ismétlődő töltelékszöveg a kontextusablak feltöltéséhez. A konkrét
 * kör- és méretszám a case saját döntése, a SPEC-000 nem ír elő pontos
 * értéket, csak azt, hogy "ismétlődő, nagy méretű" legyen.
 */
const FILLER = 'Ez egy hosszú, ismétlődő mondat a kontextusablak feltöltéséhez a mérés során. '.repeat(200);
const MAX_ROUNDS = 20;

async function* fillerPrompts(): AsyncGenerator<SDKUserMessage> {
  // Nincs valodi aszinkron munka; az `await` csak azert kell, hogy a
  // fuggveny tenylegesen async generator maradjon (AsyncIterable<SDKUserMessage>).
  await Promise.resolve();
  for (let index = 0; index < MAX_ROUNDS; index += 1) {
    yield {
      type: 'user',
      message: { role: 'user', content: `${String(index + 1)}. kör: ${FILLER}` },
      // Az SDKUserMessage tipusa kotelezoen `string | null`-t var itt (sdk.d.ts).
      // eslint-disable-next-line unicorn/no-null -- SDK altal megkovetelt ertek, nem placeholder
      parent_tool_use_id: null,
    };
  }
}

export const M13: MeasurementCase = {
  id: 'M-13',
  title: 'Kontextusablak és auto-compact',
  question: 'Q11',
  async run(context) {
    const base = buildBaseOptions(context);
    const outcome = await executeQuery({
      ctx: context,
      caseId: 'M-13',
      runId: 'a',
      prompt: fillerPrompts(),
      options: { ...base, persistSession: true, maxTurns: MAX_ROUNDS + 2 },
      timeoutMs: 5 * 60_000,
    });
    return [outcome];
  },
};
