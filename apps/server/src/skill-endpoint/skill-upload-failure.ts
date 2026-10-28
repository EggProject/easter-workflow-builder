import type { Outcome } from '@easter-workflow-builder/core';
import type { SkillUploadErrorClass } from './skill-upload-error-class.ts';

/**
 * A feltöltés elutasítása a projekt `Outcome` konvenciójával: a hibaosztály a
 * záró zárójelben áll (SPEC-006 5.5), ebből képzi az `error-mapping` az
 * `unprocessable` kódot és a törzs `errorClass` mezőjét. A `detail` a naplónak
 * és a REST klienseknek szól (SPEC-009 5.4 "A hibák megjelenése"); a felület
 * nem elemzi, a hibaosztályhoz saját mondatot rendel.
 */
export function skillUploadFailure(errorClass: SkillUploadErrorClass, detail: string): Outcome<never> {
  return { kind: 'error', message: `${detail} (${errorClass}).` };
}
