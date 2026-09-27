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

  it('a szótáron kívüli, de SAJÁT (authored) mondatú hibaosztálynál a mondat változatlan marad, errorClass kulcs nélkül', () => {
    const body = buildProtocolErrorBody('A művelet nem hajtható végre (database_closed).');

    expect(body).toStrictEqual({ code: 'internal', message: 'A művelet nem hajtható végre (database_closed).' });
    expect(Object.hasOwn(body, 'errorClass')).toBe(false);
  });

  it('zárójel nélküli, osztály nélküli üzenetre a szerver saját, nyers szöveget nem tartalmazó mondatát adja (2026-09-27, user döntés "Saját mondat, ok a naplóba"): a régi kód a nyers üzenetet adta volna vissza', () => {
    expect(buildProtocolErrorBody('nincs hibaosztály')).toStrictEqual({
      code: 'internal',
      message: 'Váratlan szerver hiba történt (internal).',
    });
  });

  it('foreign_key_violation osztályra a driver szöveget NEM tartalmazó saját mondatot ad, conflict kóddal, errorClass nélkül (2026-09-27)', () => {
    const message = 'FOREIGN KEY constraint failed (foreign_key_violation)';

    expect(buildProtocolErrorBody(message)).toStrictEqual({
      code: 'conflict',
      message: 'A kérés nem létező elemre hivatkozik (foreign_key_violation).',
    });
  });

  it('graph_id_conflict osztályra a driver szöveget NEM tartalmazó saját mondatot ad, conflict kóddal, errorClass nélkül (2026-09-27)', () => {
    const message = 'UNIQUE constraint failed: workflow_node.id (graph_id_conflict)';

    expect(buildProtocolErrorBody(message)).toStrictEqual({
      code: 'conflict',
      message: 'A gráf egy azonosítója már foglalt (graph_id_conflict).',
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
