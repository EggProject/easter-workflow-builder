/**
 * A CEL kifejezés nyelvű szkript beállítása (SPEC-014 5.3): kizárólag a futás
 * kontextust éri el, időkorlátja nincs (SPEC-010 O-2).
 */
export interface ExpressionScriptConfig {
  readonly source: string;
  readonly runtime: 'expression';
}
