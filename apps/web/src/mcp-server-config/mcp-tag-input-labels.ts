import type { TagInputLabels } from '@easter-workflow-builder/ui';

/**
 * A `TagInput` bejelentései és az eltávolító gomb neve magyarul (a komponens
 * alapértéke a forrás angol szövege).
 */
export const MCP_TAG_INPUT_LABELS: TagInputLabels = {
  added: (tag) => `Hozzáadva: ${tag}`,
  removed: (tag) => `Eltávolítva: ${tag}`,
  remove: (tag) => `Eltávolítás: ${tag}`,
};
