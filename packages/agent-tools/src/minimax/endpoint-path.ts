/**
 * A használt MiniMax útvonalak. Ezek az útvonalak a MiniMax hivatalos
 * dokumentációjában nincsenek leírva (a doksi csak az MCP eszköz szintjét
 * dokumentálja), a helyességüket saját, élő méréssel igazoltuk.
 */

/**

 * Kereső végpont, kérés törzse `{ q }`.

 */
export const PATH_SEARCH = '/v1/coding_plan/search';

/**

 * Képértelmező végpont, kérés törzse `{ prompt, image_url }`.

 */
export const PATH_VLM = '/v1/coding_plan/vlm';
