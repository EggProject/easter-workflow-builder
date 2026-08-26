/**
 * M-28: CLAUDE_AUTOCOMPACT_PCT_OVERRIDE=50 és CLAUDE_CODE_AUTO_COMPACT_WINDOW=1000000
 * együtt -- a felhasználó tényleges env beállítása. Az M-13 mintájára: hosszú,
 * ismétlődő beszélgetés, [1m] suffixes modellel (mint a felhasználó parancsában),
 * és megnézzük, hol indul a compact, és mekkora contextWindow-val dolgozik a kliens.
 * Rövidre fogva (max. 8 kör), hogy ne égessünk feleslegesen.
 */
import type { SDKUserMessage } from '@anthropic-ai/claude-agent-sdk';
import type { MeasurementCase } from '../harness/types.ts';
import { buildBaseOptions, executeQuery } from '../harness/runner.ts';

const FILLER = 'Ez egy hosszú, ismétlődő mondat a kontextusablak feltöltéséhez a mérés során. '.repeat(200);
const MAX_ROUNDS = 8;

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

export const M28: MeasurementCase = {
  id: 'M-28',
  title: 'CLAUDE_AUTOCOMPACT_PCT_OVERRIDE + CLAUDE_CODE_AUTO_COMPACT_WINDOW együtt',
  question: 'user env: CLAUDE_AUTOCOMPACT_PCT_OVERRIDE, CLAUDE_CODE_AUTO_COMPACT_WINDOW',
  async run(context) {
    const base = buildBaseOptions(context);
    const outcome = await executeQuery({
      ctx: context,
      caseId: 'M-28',
      runId: 'a',
      prompt: fillerPrompts(),
      options: {
        ...base,
        model: 'MiniMax-M3[1m]',
        persistSession: true,
        maxTurns: MAX_ROUNDS + 2,
        env: {
          ...base.env,
          CLAUDE_AUTOCOMPACT_PCT_OVERRIDE: '50',
          CLAUDE_CODE_AUTO_COMPACT_WINDOW: '1000000',
        },
      },
      timeoutMs: 5 * 60_000,
    });
    return [outcome];
  },
};
