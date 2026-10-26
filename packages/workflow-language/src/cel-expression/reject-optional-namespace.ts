import type { Outcome } from '@easter-workflow-builder/core';
import { isString, isUnknownArray } from '@easter-workflow-builder/typeguards';
import { isCelAstNode, type CelAstNode } from './is-cel-ast-node.ts';

const OPTIONAL_NAMESPACE = 'optional';

/**
 * A változót kötő makrók neve (a telepített csomag `lib/macros.js`
 * `registerMacros` függvénye): az első argumentum a ciklusváltozó, ami a többi
 * argumentumban látszik. A `cel.bind(változó, érték, kifejezés)` külön ág, mert
 * ott a változó csak a harmadik argumentumban látszik.
 */
const BINDING_MACRO_NAMES: ReadonlySet<string> = new Set(['all', 'exists', 'exists_one', 'map', 'filter']);

const SENTENCE = 'az optional névtér nem használható, mert az opcionális típusok ki vannak kapcsolva';

interface MacroScope {
  readonly variable: string;
  readonly outer: readonly CelAstNode[];
  readonly inner: readonly CelAstNode[];
}

function childNodesOf(value: unknown): readonly CelAstNode[] {
  if (isCelAstNode(value)) {
    return [value];
  }
  return isUnknownArray(value) ? value.flatMap((item) => childNodesOf(item)) : [];
}

/**
 * A változót kötő metódushívás hatóköre: a kötött név, a kötésen kívül látott
 * részfák (a fogadó és a `cel.bind` értéke) és a kötésen belüliek.
 */
function macroScopeOf(node: CelAstNode): MacroScope | undefined {
  if (node.op !== 'rcall' || !isUnknownArray(node.args)) {
    return undefined;
  }
  const [name, receiver, callArguments] = node.args;
  if (!isString(name) || !isCelAstNode(receiver) || !isUnknownArray(callArguments)) {
    return undefined;
  }
  const [variable, ...rest] = callArguments;
  if (!isCelAstNode(variable) || variable.op !== 'id' || !isString(variable.args)) {
    return undefined;
  }
  if (name === 'bind' && receiver.op === 'id' && receiver.args === 'cel') {
    const [value, ...body] = rest;
    return { variable: variable.args, outer: childNodesOf(value), inner: childNodesOf(body) };
  }
  return BINDING_MACRO_NAMES.has(name)
    ? { variable: variable.args, outer: [receiver], inner: childNodesOf(rest) }
    : undefined;
}

function firstUnbound(nodes: readonly CelAstNode[], bound: ReadonlySet<string>): CelAstNode | undefined {
  for (const node of nodes) {
    const found = findUnbound(node, bound);
    if (found !== undefined) {
      return found;
    }
  }
  return undefined;
}

function findUnbound(node: CelAstNode, bound: ReadonlySet<string>): CelAstNode | undefined {
  if (node.op === 'id') {
    return node.args === OPTIONAL_NAMESPACE && !bound.has(OPTIONAL_NAMESPACE) ? node : undefined;
  }
  const scope = macroScopeOf(node);
  if (scope === undefined) {
    return firstUnbound(childNodesOf(node.args), bound);
  }
  return firstUnbound(scope.outer, bound) ?? firstUnbound(scope.inner, new Set([...bound, scope.variable]));
}

/**
 * A `compile` saját ellenőrzése az `optional` névre (SPEC-010 7.2, O-23, user
 * döntés 2026-10-25). A környezet az opcionális típusokat kikapcsolva építi
 * (`enableOptionalTypes` alapértéke), a könyvtár viszont az `optional` nevet ekkor
 * is deklarált konstansként ismeri, ezért a `check` átengedi az `optional.of(1)`
 * és az `optional.none()` alakot, a kiértékelés pedig mindig `unknown_variable`
 * hibával bukik (research `2026-10-25-plan-010-adverzarialis-atvizsgalas.md`
 * A-5). Az ellenőrzés a `parse` AST-jét járja be: egy `optional` azonosító
 * csomópont hibát ad, ha nem egy makró vagy a `cel.bind` saját változója; a
 * mezőnév (`input.optional`) és a szöveg literál (`"optional"`) nem azonosító
 * csomópont, ezért nem érinti.
 */
export function rejectOptionalNamespace(ast: unknown): Outcome<void> {
  const found = firstUnbound(childNodesOf(ast), new Set());
  return found === undefined
    ? { kind: 'ok', value: undefined }
    : { kind: 'error', message: `${SENTENCE} (pozíció: ${String(found.start)})` };
}
