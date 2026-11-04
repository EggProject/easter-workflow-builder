import { SetConcurrencyLimitRequestSchema } from '@easter-workflow-builder/protocol';

const DIGITS_ONLY = /^\d+$/;

/**
 * A párhuzamossági korlát mezőjének szövegéből a mentendő szám, vagy
 * `undefined`, ha az érték nem pozitív egész (SPEC-009 12. szekció AC5). A
 * kizárólag számjegyekből álló szöveg a `SetConcurrencyLimitRequestSchema`
 * szabályán megy át (pozitív, biztonságos egész), tehát a mező és a szerver
 * ugyanazt az elfogadási szabályt használja; az üres mező, a tört, az előjeles
 * és a kitevős alak a számjegy szűrőn elbukik.
 */
export function parseConcurrencyLimitDraft(draft: string): number | undefined {
  const trimmed = draft.trim();
  if (!DIGITS_ONLY.test(trimmed)) {
    return undefined;
  }
  const parsed = SetConcurrencyLimitRequestSchema.safeParse({ maxConcurrentSteps: Number(trimmed) });
  return parsed.success ? parsed.data.maxConcurrentSteps : undefined;
}
