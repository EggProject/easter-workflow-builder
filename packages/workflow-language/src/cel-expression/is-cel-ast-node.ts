import { isInt, isRecord, isString } from '@easter-workflow-builder/typeguards';

/**
 * A `@marcbachmann/cel-js` `parse` eredményének AST csomópont alakja, amennyit
 * az `optional` név ellenőrzése olvas: a művelet (`op`), az argumentumok
 * (`args`, műveletenként más alak) és a forrásbeli kezdő eltolás (`start`).
 * A telepített csomag `lib/index.d.ts` `ASTNode` típusa (8.0.0).
 */
export interface CelAstNode {
  readonly op: string;
  readonly args: unknown;
  readonly start: number;
}

/**
 * Igaz, ha az érték CEL AST csomópont alakú (`CelAstNode`).
 */
export function isCelAstNode(value: unknown): value is CelAstNode {
  return isRecord(value) && isString(value['op']) && Object.hasOwn(value, 'args') && isInt(value['start']);
}
