/* eslint-disable unicorn/no-null -- a CreateWorkflowInput nullázható mezői (description, providerId) tárolt `null` értéket hordoznak (SPEC-003 4.3) */
import { describe, expect, it } from 'vitest';
import { isOkOutcome } from '@easter-workflow-builder/core';
import { openDatabase } from '@easter-workflow-builder/db';
import { formatEngineErrorMessage } from '@easter-workflow-builder/engine';
import { SKILL_UPLOAD_ERROR_CLASSES } from '../skill-endpoint/skill-upload-error-class.ts';
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
    'graph_id_conflict',
    'already_decided',
  ])('a(z) %s hibaosztályt conflict kódra képezi', (errorClass) => {
    expect(mapOutcomeMessageToErrorCode(`hiba történt (${errorClass}).`)).toBe('conflict');
  });

  it.each(SKILL_UPLOAD_ERROR_CLASSES)(
    'a skill feltöltés %s hibaosztályát unprocessable kódra képezi (SPEC-009 5.4)',
    (errorClass) => {
      expect(mapOutcomeMessageToErrorCode(`A feltöltés elutasítva (${errorClass}).`)).toBe('unprocessable');
    },
  );

  it.each(['malformed_graph_document', 'unknown_graph_document_version', 'non_canonicalizable_value'])(
    'a(z) %s hibaosztályt unprocessable kódra képezi',
    (errorClass) => {
      expect(mapOutcomeMessageToErrorCode(`hiba történt (${errorClass}).`)).toBe('unprocessable');
    },
  );

  // A motor saját formázójával előállított üzenet: a `kind` paraméter típusa
  // `EngineErrorKind`, tehát egy átnevezett hibaosztály itt fordítási hibát ad.
  // A 4.2, 4.5, 4.6, 4.8, 8.2 és 11.3 osztályai 2026-09-26-ig `internal`
  // kódot kaptak (regresszió).
  it.each([
    'no_default_provider',
    'graph_cycle_detected',
    'loop_back_edge_outside_body',
    'loop_missing_branch_edge',
    'reserved_branch_key_misuse',
    'unbalanced_fan_out_scope',
    'invalid_start_node',
    'dangling_edge',
    'unreachable_node',
    'unimplemented_node_type',
    'branch_key_unknown',
    'invalid_error_handler_edge',
    'malformed_node_config',
    'unhandled_error_policy_missing',
    'insufficient_backoff_list',
    'missing_required_input',
    'structured_output_strategy_unsupported',
    'insufficient_max_turns',
    'forced_tool_choice_silently_dropped',
    'model_not_selected',
    'unknown_model_id',
    'thinking_mode_unsupported',
    'effort_unsupported',
    'provider_descriptor_sdk_mismatch',
    'template_render_failed',
    'expression_evaluation_failed',
    'skill_not_found',
  ] as const)('a motor %s validációs hibaosztályát unprocessable kódra képezi', (kind) => {
    expect(mapOutcomeMessageToErrorCode(formatEngineErrorMessage(kind, 'A futás nem indítható'))).toBe('unprocessable');
  });

  it('a db replaceGraph írás előtti isNodeConfig hibáját (malformed_node_config) unprocessable kódra képezi, a meglévő ágon (user döntés 2026-10-17)', () => {
    // A valódi `:memory:` adatbázis saját üzenete: ha a `db` átnevezi a
    // hibaosztályt, ez a teszt bukik, és nem esik csendben `internal` kódra.
    const database = openDatabase(':memory:');
    if (!isOkOutcome(database)) {
      throw new Error(`váratlan hibaág: ${database.message}`);
    }
    const workflow = database.value.workflows.createWorkflow({ name: 'Teszt', description: null, providerId: null });
    if (!isOkOutcome(workflow)) {
      throw new Error(`váratlan hibaág: ${workflow.message}`);
    }

    const replaced = database.value.workflows.replaceGraph(
      workflow.value.id,
      [
        {
          id: 'n1',
          label: 'Ismétlés',
          positionX: 0,
          positionY: 0,
          config: { type: 'loop', maxIterations: 0, continueExpression: 'true', onUnhandledError: 'fail_run' },
        },
      ],
      [],
    );
    database.value.close();

    expect(replaced.kind).toBe('error');
    expect(replaced.kind === 'error' && mapOutcomeMessageToErrorCode(replaced.message)).toBe('unprocessable');
  });

  it('a végpont kezelő invalid_request hibaosztályát invalid_request kódra képezi (2026-09-26-ig internal volt)', () => {
    expect(mapOutcomeMessageToErrorCode('A kérés törzse érvénytelen, hibás mező(k): name (invalid_request).')).toBe(
      'invalid_request',
    );
  });

  it('a motor valódi engine_shutting_down üzenetét service_unavailable kódra képezi (SPEC-005 8.3, sodródás védelem futásidejű ága)', () => {
    // Az üzenetet a motor saját formázója állítja elő, tehát ha a motor a
    // hibaosztály nevét vagy az üzenet alakját megváltoztatja, ez a teszt bukik.
    const message = formatEngineErrorMessage('engine_shutting_down', 'A motor leáll, új futás nem indul');

    expect(mapOutcomeMessageToErrorCode(message)).toBe('service_unavailable');
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
