import { describe, expect, it } from 'vitest';
import { mapOutcomeMessageToErrorCode } from './map-outcome-message-to-error-code.ts';

describe('mapOutcomeMessageToErrorCode', () => {
  it('a not_found hibaosztályt not_found kódra képezi', () => {
    expect(mapOutcomeMessageToErrorCode('A(z) "abc" workflow nem található (not_found).')).toBe('not_found');
  });

  it.each([
    'illegal_status_transition',
    'foreign_key_violation',
    'duplicate_event',
    'graph_snapshot_hash_collision',
    'already_decided',
  ])('a(z) %s hibaosztályt conflict kódra képezi', (errorClass) => {
    expect(mapOutcomeMessageToErrorCode(`hiba történt (${errorClass}).`)).toBe('conflict');
  });

  it.each([
    'no_default_provider',
    'malformed_graph_document',
    'unknown_graph_document_version',
    'non_canonicalizable_value',
    'invalid_start_node',
    'dangling_edge',
    'unreachable_node',
    'unimplemented_node_type',
    'branch_key_unknown',
    'invalid_error_handler_edge',
    'malformed_node_config',
    'unhandled_error_policy_missing',
    'unsupported_join_merge_setting',
    'expression_evaluator_unavailable',
  ])('a(z) %s hibaosztályt unprocessable kódra képezi', (errorClass) => {
    expect(mapOutcomeMessageToErrorCode(`hiba történt (${errorClass}).`)).toBe('unprocessable');
  });

  it('a database_closed hibaosztályt internal kódra képezi', () => {
    expect(mapOutcomeMessageToErrorCode('A művelet nem hajtható végre (database_closed).')).toBe('internal');
  });

  it('a be nem sorolt, de zárójelben álló hibaosztályt internal kódra képezi', () => {
    expect(mapOutcomeMessageToErrorCode('ismeretlen hiba (valami_uj_hibaosztaly).')).toBe('internal');
  });

  it('zárójel nélküli üzenetre internal kódot ad', () => {
    expect(mapOutcomeMessageToErrorCode('nincs zárójeles hibaosztály ebben az üzenetben')).toBe('internal');
  });

  it('a zárójelen KÍVÜL, szabad szövegben szereplő hibaosztály nevet nem ismeri fel, a záró zárójel dönt', () => {
    // A "not_found" szó itt szabad szövegben áll, nem a záró zárójelben; a
    // felismerés csak a záró zárójelre horgonyoz, tehát a valódi, be nem
    // sorolt záró hibaosztály (`egyeb_hiba`) dönt, nem a szövegbeli szó.
    expect(
      mapOutcomeMessageToErrorCode('a not_found eset itt szabad szövegben áll, más okból bukott (egyeb_hiba).'),
    ).toBe('internal');
  });

  it('az üzenet eleji "A(z)" zárójel nem zavarja meg a felismerést', () => {
    expect(mapOutcomeMessageToErrorCode('A(z) "x" azonosítójú workflow nem található (not_found).')).toBe('not_found');
  });
});
