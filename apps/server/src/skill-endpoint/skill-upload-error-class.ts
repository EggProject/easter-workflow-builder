import type { ProtocolErrorClass } from '@easter-workflow-builder/protocol';

/**
 * A skill feltöltés tizenöt elutasítási oka (SPEC-009 5.4 táblázata, O-41,
 * user döntés 2026-10-28), egyetlen táblában. Mind szerver oldali osztály, nem
 * a motor `EngineErrorKind` uniójának tagja; a `satisfies` miatt egy, a
 * protokoll szótárából hiányzó tag a `typecheck` kapun bukik, a fordított
 * irányt az `error-class-drift-protection` típusszintű ága őrzi. A kód mind a
 * tizenötre `unprocessable` (SPEC-005 8.3, a `malformed_graph_document`
 * precedense; `map-outcome-message-to-error-code.ts`).
 */
export const SKILL_UPLOAD_ERROR_CLASSES = [
  'skill_archive_unreadable',
  'skill_archive_entry_type_unsupported',
  'skill_archive_unsafe_path',
  'skill_archive_path_collision',
  'skill_archive_layout_invalid',
  'skill_manifest_missing',
  'skill_manifest_duplicate',
  'skill_manifest_invalid',
  'skill_name_invalid',
  'skill_name_mismatch',
  'skill_archive_too_large',
  'skill_archive_too_many_entries',
  'skill_archive_entry_size_mismatch',
  'skill_archive_entry_encrypted',
  'skill_archive_compression_unsupported',
] as const satisfies readonly ProtocolErrorClass[];

export type SkillUploadErrorClass = (typeof SKILL_UPLOAD_ERROR_CLASSES)[number];
