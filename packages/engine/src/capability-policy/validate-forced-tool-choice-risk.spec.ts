import { describe, expect, it } from 'vitest';
import type { Fact, ToolChoiceCapability, ToolChoiceValue } from '@easter-workflow-builder/provider-capability';
import { validateForcedToolChoiceRisk } from './validate-forced-tool-choice-risk.ts';

function knownFact<TValue>(value: TValue): Fact<TValue> {
  return { state: 'known', value, evidence: [{ kind: 'measurement', id: 'M-01' }] };
}

function unknownFact<TValue>(): Fact<TValue> {
  return { state: 'unknown', reason: 'A mérés még nem futott le.', blockedBy: ['M-99'] };
}

// A három mező mindegyike külön állítható, mert a kockázat pontosan a
// kombinációjukból áll össze (SPEC-004 11.3 táblázat 4. sor).
function buildToolChoice(
  accepted: Fact<readonly ToolChoiceValue[]>,
  rejectionBehaviour: Fact<'http_400' | 'silently_dropped'>,
  sdkSendsForcedChoice: Fact<boolean>,
): ToolChoiceCapability {
  return { accepted, rejectionBehaviour, sdkSendsForcedChoice };
}

const ok = { kind: 'ok', value: undefined };
const silentlyDropped: Fact<'http_400' | 'silently_dropped'> = knownFact('silently_dropped');
const httpRejection: Fact<'http_400' | 'silently_dropped'> = knownFact('http_400');
const unknownRejection = unknownFact<'http_400' | 'silently_dropped'>();
const withoutForcing = knownFact<readonly ToolChoiceValue[]>(['auto', 'none']);
const withAny = knownFact<readonly ToolChoiceValue[]>(['auto', 'none', 'any']);
const withTool = knownFact<readonly ToolChoiceValue[]>(['tool']);
const unknownAccepted = unknownFact<readonly ToolChoiceValue[]>();
const sdkForces = knownFact(true);

describe('validateForcedToolChoiceRisk', () => {
  it('known: a kockázatos kombináció forced_tool_choice_silently_dropped hibát ad', () => {
    const toolChoice = buildToolChoice(withoutForcing, silentlyDropped, sdkForces);

    expect(validateForcedToolChoiceRisk(toolChoice)).toStrictEqual({
      kind: 'error',
      message:
        'Az SDK kényszerített tool_choice értéket küld, amit a provider nem fogad el és csendben eldob (forced_tool_choice_silently_dropped).',
    });
  });

  it('known hamis: az SDK nem küld kényszerítést, tehát nincs kockázat', () => {
    const toolChoice = buildToolChoice(withoutForcing, silentlyDropped, knownFact(false));

    expect(validateForcedToolChoiceRisk(toolChoice)).toStrictEqual(ok);
  });

  it('known: a provider elfogadja az any értéket, tehát nincs kockázat', () => {
    const toolChoice = buildToolChoice(withAny, silentlyDropped, sdkForces);

    expect(validateForcedToolChoiceRisk(toolChoice)).toStrictEqual(ok);
  });

  it('known: a provider elfogadja a tool értéket, tehát nincs kockázat', () => {
    const toolChoice = buildToolChoice(withTool, silentlyDropped, sdkForces);

    expect(validateForcedToolChoiceRisk(toolChoice)).toStrictEqual(ok);
  });

  it('known: az elutasítás 400-as, tehát látható, nem csendes, és nincs hibaág', () => {
    const toolChoice = buildToolChoice(withoutForcing, httpRejection, sdkForces);

    expect(validateForcedToolChoiceRisk(toolChoice)).toStrictEqual(ok);
  });

  it('unknown sdkSendsForcedChoice: a motor nem épít kényszerítésre, nincs hibaág', () => {
    const toolChoice = buildToolChoice(withoutForcing, silentlyDropped, unknownFact<boolean>());

    expect(validateForcedToolChoiceRisk(toolChoice)).toStrictEqual(ok);
  });

  it('unknown accepted: nincs bizonyíték az elutasításra, nincs hibaág', () => {
    const toolChoice = buildToolChoice(unknownAccepted, silentlyDropped, sdkForces);

    expect(validateForcedToolChoiceRisk(toolChoice)).toStrictEqual(ok);
  });

  it('unknown rejectionBehaviour: nincs bizonyíték a csendes eldobásra, nincs hibaág', () => {
    const toolChoice = buildToolChoice(withoutForcing, unknownRejection, sdkForces);

    expect(validateForcedToolChoiceRisk(toolChoice)).toStrictEqual(ok);
  });
});
