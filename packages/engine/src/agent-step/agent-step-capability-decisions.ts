import type { ThinkingMode } from '@easter-workflow-builder/provider-capability';
import type { DisallowedServerToolsDecision } from '../capability-policy/disallowed-server-tools-decision.ts';
import type { ModelIdentifierDecision } from '../capability-policy/model-identifier-decision.ts';
import type { StructuredOutputStrategyDecision } from '../capability-policy/structured-output-strategy-decision.ts';

/**
 * A lépéshez tartozó, **leírótól függő** döntések együtt (SPEC-004 11.3
 * táblázat), ahogy a `capability-policy` téma tiszta függvényeiből
 * összeállnak. Ez az `Options` összeállítás bemenete, és egyben a
 * `step_started` esemény három `unproven` jelölőjének forrása.
 *
 * A mezők a táblázat sorszámával:
 *
 * - `model`: 5. sor, a kimenő `Options.model` érték és a
 *   `modelIdentifierUnproven` jelölő.
 * - `structuredOutput`: 1. sor. `undefined`, ha a lépés nem vár strukturált
 *   kimenetet (`AgentStepConfig.structuredOutput` `null`); ilyenkor a 3. sor
 *   (`maxTurns` alsó korlát) sem alkalmazható, mert az a **választott
 *   stratégia** megfigyelt körszámaiból jön. A mezőt az `Options`
 *   összeállítás nem olvassa (az a lépés configjából dolgozik), a
 *   `strategyUnproven` jelölő viszont innen kerül a `step_started` payloadba.
 * - `thinking`: 8. sor. **A kiküldendő érték, nem a döntés neve**:
 *   `undefined`, ha a mező elmarad. A `CapabilityFieldInclusion` és a lépés
 *   beállítása itt már össze van vonva, hogy az `Options` összeállításában ne
 *   keletkezzen olyan ellenőrzés, ami logikailag sosem bukik el (a 100
 *   százalékos lefedettségi küszöb tiltja az ilyen ágat, `.claude/CLAUDE.md` 5.).
 * - `effort`: 9. sor, ugyanaz az elv, mint a `thinking` mezőnél.
 * - `disallowedServerTools`: 12. sor, a letiltandó kliens tool nevek és a
 *   `serverToolAvailabilityUnproven` jelölő.
 * - `includePartialMessages`: 13. sor.
 *
 * A 4. sor (`validateForcedToolChoiceRisk`) és a 6., 7. sor
 * (`requireModelSelection`, `validateModelId`) nem hagy maga után döntést,
 * csak hibaágat, illetve a `model` mező bemenetét, ezért nincs saját mezőjük.
 */
export interface AgentStepCapabilityDecisions {
  readonly model: ModelIdentifierDecision;
  readonly structuredOutput: StructuredOutputStrategyDecision | undefined;
  readonly thinking: ThinkingMode | undefined;
  readonly effort: string | undefined;
  readonly disallowedServerTools: DisallowedServerToolsDecision;
  readonly includePartialMessages: boolean;
}
