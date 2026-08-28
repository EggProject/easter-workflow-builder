import type { BranchContext, BranchScope } from '../branch-scope/branch-scope.ts';
import type { StepInstanceReference } from './step-instance-reference.ts';

// Egy hatókör bejegyzés összehasonlítható alakja. **Mind a három mező benne
// van**, a `stepRunId` is: lásd a `findVisibleStepInstance` doksijának "Mit
// hasonlítunk" szakaszát.
function scopeKey(scope: BranchScope): readonly [string, string, number] {
  return scope.kind === 'fan_out'
    ? [scope.kind, scope.stepRunId, scope.itemIndex]
    : [scope.kind, scope.stepRunId, scope.iteration];
}

// A verem összehasonlítható alakja. Nem elemenként, index szerint hasonlítunk,
// hanem egyetlen kulcson, ugyanazzal a megfontolással, mint a `branch-scope`
// téma `scopeStackKey` függvénye: a JSON alak a keretek sorrendjét és minden
// mezőjét egyértelműen kódolja, elválasztó karakter félreértése nélkül.
function contextKey(context: BranchContext): string {
  return JSON.stringify(context.map((scope) => scopeKey(scope)));
}

// A `candidate` verem előtagja-e a `current` veremnek. A hosszabb jelölt verem
// automatikusan megbukik: a `slice` ilyenkor a teljes, rövidebb `current`
// vermet adja vissza, aminek a kulcsa nem egyezhet a jelölt kulcsával.
function isContextPrefix(candidate: BranchContext, current: BranchContext): boolean {
  return contextKey(candidate) === contextKey(current.slice(0, candidate.length));
}

/**
 * A `nodeId` node **látható** lefutott példánya a `branchContext` ág
 * kontextusból nézve, a SPEC-004 6.2 szekció szerint: "van olyan lefutott
 * példánya, aminek az ág kontextusa a jelenlegi példány kontextusának előtagja
 * ... A feloldás a legbelső ilyen példányt adja."
 *
 * Ez a szabálynak **csak az ág kontextus fele**; a gráfbeli ős feltételt a
 * `resolveStepReference` és a `buildRunContext` adja hozzá, a
 * `collectAncestorNodeIds` halmazával.
 *
 * **Mit hasonlítunk a hatókör bejegyzésben.** Mind a három mezőt: a `kind`
 * értéket, a `stepRunId` értéket és a diszkrimináló számot (`itemIndex`,
 * illetve `iteration`). A `stepRunId` bevétele nem szigorítás kedvéért van,
 * hanem azért, mert nélküle két **különböző** `fan_out` node azonos sorszámú
 * eleme azonos kontextusnak látszana. Egy `f1 -> A -> j1 -> f2 -> B -> j2`
 * alakú gráfban az `A` és a `B` node verme egyaránt egyetlen `fan_out` keret,
 * és a `kind` plusz `itemIndex` pár mindkettőn ugyanaz; az `A` kimenete
 * mégsem címezhető a `B` node-ból, mert `A` a saját fan-out ágaiban N-szer
 * futott, és nincs meghatározva, melyik ágé az érték (6.2 zárómondata). A
 * hatókört nyitó lépés futásának azonosítója pontosan ezt a két hatókört
 * választja szét, és ugyanaz az érték áll a hatókörön belüli **minden**
 * példány keretében, mert a keretet a nyitó lépés egyszer állítja elő és a
 * leszármazottak másolják (4.5). Ugyanezért nem okoz gondot, hogy egy `loop`
 * node iterációnként új `step_run` sort kap (4.6): az azonos iterációban futott
 * példányok keretében ugyanaz a `stepRunId` áll.
 *
 * **A legbelső példány kiválasztása.** A jelöltek közül a **leghosszabb**
 * kontextusú nyer, döntetlen esetén a **legutóbb** lefutott, azaz a listában
 * hátrébb álló. A döntetlen ág a valóban előforduló eset: a retry ugyanabban
 * az ág kontextusban indít újabb lefutást (SPEC-003 4.10), tehát ott a frissebb
 * kimenetet kell látni. A hossz szerinti ág a spec "legbelső" szavának
 * közvetlen leképezése; a futás indítási validáció ma egyetlen hatókör
 * mélységet enged node-onként (`validateScopeBalance`), de ez a függvény a
 * kapott listáról dönt, nem a gráf invariánsáról, ezért a sorrendet a
 * `.spec.ts` mindkét irányban rögzíti.
 *
 * **Miért generikus a példány típusa.** A feloldási szabály kizárólag a
 * `StepInstanceReference` két mezőjén (`nodeId`, `branchContext`) dolgozik, a
 * példányhoz kötött hasznos adaton nem. Két hívó két különböző sorral dolgozik
 * ugyanezen a szabályon: a `run-context` téma az `ExecutedStepInstance`
 * kimenetével, az `agent-step` téma pedig a session azonosítót hordozó
 * `SessionBearingInstance` sorral (SPEC-004 6.3, "A folytatandó session
 * feloldása"). A típusparaméter ezért nem előre gyártott rugalmasság: nélküle
 * az ág kontextus előtag szabálya két helyen állna, két, egymástól
 * elcsúszható másolatban.
 */
export function findVisibleStepInstance<TInstance extends StepInstanceReference>(
  instances: readonly TInstance[],
  nodeId: string,
  branchContext: BranchContext,
): TInstance | undefined {
  let visible: TInstance | undefined;

  for (const candidate of instances) {
    if (candidate.nodeId !== nodeId || !isContextPrefix(candidate.branchContext, branchContext)) {
      continue;
    }
    if (visible === undefined || candidate.branchContext.length >= visible.branchContext.length) {
      visible = candidate;
    }
  }

  return visible;
}
