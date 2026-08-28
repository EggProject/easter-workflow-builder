import { describe, expect, it } from 'vitest';
import { readResultTelemetry } from './read-result-telemetry.ts';

const fullUsage = {
  input_tokens: 11,
  output_tokens: 22,
  cache_read_input_tokens: 33,
  cache_creation_input_tokens: 44,
};

describe('readResultTelemetry', () => {
  it('teljes result üzenetből a num_turns és a négy token mező kijön', () => {
    expect(readResultTelemetry({ type: 'result', subtype: 'success', num_turns: 3, usage: fullUsage })).toStrictEqual({
      numTurns: 3,
      tokens: { inputTokens: 11, outputTokens: 22, cacheReadInputTokens: 33, cacheCreationInputTokens: 44 },
    });
  });

  it('nem rekord bemenetre mindkét mező undefined', () => {
    expect(readResultTelemetry(undefined)).toStrictEqual({ numTurns: undefined, tokens: undefined });
  });

  it('hiányzó usage objektumra a token összesítés undefined marad', () => {
    expect(readResultTelemetry({ type: 'result', subtype: 'success', num_turns: 2 })).toStrictEqual({
      numTurns: 2,
      tokens: undefined,
    });
  });

  it('részleges usage objektumra sincs token összesítés, mert a négy oszlop együtt íródik', () => {
    const partialUsage = { input_tokens: 11, output_tokens: 22, cache_read_input_tokens: 33 };

    expect(readResultTelemetry({ type: 'result', subtype: 'success', usage: partialUsage }).tokens).toBeUndefined();
  });

  it('nem szám típusú token mező ugyanúgy kiejti az összesítést, nullát nem pótolunk', () => {
    const textUsage = { ...fullUsage, output_tokens: '22' };

    expect(readResultTelemetry({ type: 'result', subtype: 'success', usage: textUsage }).tokens).toBeUndefined();
  });

  it('nem szám num_turns értékre a mező undefined marad', () => {
    expect(readResultTelemetry({ type: 'result', subtype: 'success', num_turns: '3' }).numTurns).toBeUndefined();
  });
});
