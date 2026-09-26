import { describe, expect, it } from 'vitest';
import { formatEngineErrorMessage } from '@easter-workflow-builder/engine';
import { ProtocolErrorBodySchema } from '@easter-workflow-builder/protocol';
import { buildProtocolErrorBody } from './build-protocol-error-body.ts';

describe('buildProtocolErrorBody', () => {
  it('a motor no_default_provider üzenetéből unprocessable kódot és errorClass mezőt ad', () => {
    const message = formatEngineErrorMessage('no_default_provider', 'Nincs alapértelmezett provider');

    expect(buildProtocolErrorBody(message)).toStrictEqual({
      code: 'unprocessable',
      message,
      errorClass: 'no_default_provider',
    });
  });

  it('a motor graph_cycle_detected üzenetéből unprocessable kódot és errorClass mezőt ad', () => {
    const message = formatEngineErrorMessage('graph_cycle_detected', 'A gráf kört tartalmaz: a, b');

    expect(buildProtocolErrorBody(message)).toStrictEqual({
      code: 'unprocessable',
      message,
      errorClass: 'graph_cycle_detected',
    });
  });

  it('az already_decided hibaosztályból conflict kódot és errorClass mezőt ad', () => {
    const message = 'A(z) "s1" lépés futáshoz tartozó jóváhagyás már el van döntve (already_decided).';

    expect(buildProtocolErrorBody(message)).toStrictEqual({ code: 'conflict', message, errorClass: 'already_decided' });
  });

  it('a szótáron kívüli hibaosztálynál nincs errorClass kulcs', () => {
    const body = buildProtocolErrorBody('A művelet nem hajtható végre (database_closed).');

    expect(body).toStrictEqual({ code: 'internal', message: 'A művelet nem hajtható végre (database_closed).' });
    expect(Object.hasOwn(body, 'errorClass')).toBe(false);
  });

  it('zárójel nélküli üzenetnél nincs errorClass kulcs', () => {
    expect(buildProtocolErrorBody('nincs hibaosztály')).toStrictEqual({
      code: 'internal',
      message: 'nincs hibaosztály',
    });
  });

  it('a végpont kezelő invalid_request hibájából 400-as kódot ad, errorClass nélkül', () => {
    const message = 'A kérés törzse érvénytelen, hibás mező(k): name (invalid_request).';

    expect(buildProtocolErrorBody(message)).toStrictEqual({ code: 'invalid_request', message });
  });

  it('a kimenet a protokoll sémáján átmegy (a szerver a saját szerződését adja)', () => {
    const message = formatEngineErrorMessage('unreachable_node', 'A(z) x node nem érhető el');

    expect(ProtocolErrorBodySchema.safeParse(buildProtocolErrorBody(message)).success).toBe(true);
  });
});
