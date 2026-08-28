import type { NodeType } from '@easter-workflow-builder/db';
import type { ProviderId } from '@easter-workflow-builder/provider-capability';

/**
 * A `step_started` esemény payloadja (SPEC-004 13. szekció táblázat,
 * `step_started` sor): a lépés `running` állapotba lépésekor íródik.
 *
 * Az öt kötelező mező mellett három **opcionális jelölő** áll, mindegyik a
 * SPEC-004 11.3 táblázat egy-egy `unknown` ágából (`capability-policy` téma,
 * PLAN-005 T-005-13). Mindhárom ugyanazt mondja el a felületnek: a motor
 * lefuttatja a lépést, de a döntés mögött nincs mérés, tehát a viselkedés nem
 * bizonyított. Ez nem hiba, ezért nem hibaosztály, hanem esemény adat.
 *
 * A mezők akkor és csak akkor kerülnek a payloadba, ha az adott bizonytalanság
 * ténylegesen fennáll; a hiányuk a "bizonyított" eset, tehát a felület
 * hiányzó mezőre nem ír ki figyelmeztetést.
 */
export interface StepStartedPayload {
  readonly nodeId: string;
  readonly nodeType: NodeType;
  readonly providerId: ProviderId;
  readonly attempt: number;
  readonly iteration: number;
  /**
   * 11.3 táblázat 1. sora: a lépés strukturált kimenet stratégiájának
   * `usable` mezője `unknown`, tehát a stratégia használható, de nem
   * bizonyítottan.
   */
  readonly strategyUnproven?: boolean;
  /**
   * 11.3 táblázat 5. sora: a modell `clientModelIdentifier` mezője `unknown`,
   * tehát a motor a **wire** azonosítót adta át kliens azonosító helyett.
   */
  readonly modelIdentifierUnproven?: boolean;
  /**
   * 11.3 táblázat 12. sora: legalább egy szerver oldali tool elérhetősége vagy
   * kliens oldali neve `unknown`, tehát a motor nem tiltott le olyan toolt,
   * ami lehet, hogy nem működik. Logikai, nem névlista: a bizonytalanság éppen
   * azt jelentheti, hogy a nevek sem ismertek.
   */
  readonly serverToolAvailabilityUnproven?: boolean;
}
