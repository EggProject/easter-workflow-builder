import type { Fact } from '../evidence/fact.ts';

/**
 * A `GET /v1/models` végpont. Külön mezőcsoport, mert a "lekérhető" és a
 * "az SDK le is kéri" két különböző dolog, és a Kapcsolat teszt gomb terve a
 * kettő különbségén áll.
 */
export interface ModelsEndpointCapability {
  /**
  Válaszol-e a végpont közvetlen, SDK-n kívüli HTTP hívásra.
  */
  readonly directHttpReachable: Fact<boolean>;
  /**
  Meghívja-e az SDK saját maga ezt az útvonalat a mért konfigurációban.
  */
  readonly calledBySdk: Fact<boolean>;
  /**
  A válasz `data` tömbjének hossza, ha a végpont válaszolt.
  */
  readonly listedModelCount: Fact<number>;
}
