import type { StepInstanceReference } from '../run-context/step-instance-reference.ts';

/**
 * Az ütemező állapotát léptető események (SPEC-004 4.4 ... 4.6). Mind az öt egy
 * **már lezárult** node példányról szól: az ütemező nem dönt arról, mi a
 * választott ág, hány elemre bomlik egy `fan_out`, vagy folytatódik-e a
 * ciklus; azt a node végrehajtó dönti el (5. szekció), és ide már kész
 * eredményként érkezik.
 *
 * - `node_completed`: a példány lefutott, és a `liveEdgeIds` halmaz mondja
 *   meg, mely kimenő élei kapnak `live` jelölést; minden más kimenő éle
 *   `dead` jelölést kap (4.4 4. pont). A `branch` node választott ága, a
 *   `human_approval` döntés iránya, az `error_handler` `exhausted` éle és a
 *   kezeletlen hiba `fail_branch` politikája (8.3) mind ugyanez az esemény.
 * - `fan_out_expanded`: a példány N elemre bomlott. Az `items` az elem
 *   **értékek** listája, mert az ütemezőnek a `RunContext.item` mezőhöz azt is
 *   nyilván kell tartania (6.1); a `stepRunId` a kibontó lépés futásának
 *   azonosítója, ami a nyitott hatókör bejegyzésekbe kerül (4.3).
 * - `loop_advanced`: a `loop` példány lefutott, és a `shouldContinue` a
 *   kiértékelt `continueExpression` logikai eredménye (4.6 3. pont). Az
 *   `iteration` értéket az ütemező maga vezeti, ezért az eseményben nincs
 *   benne.
 * - `outgoing_marks_deferred`: a példány lezárult, de a sorsa **még nem
 *   végleges**, mert újabb lefutás jöhet. Kizárólag a `liveEdgeIds` élek
 *   kapnak `live` jelölést, minden más kimenő éle **jelöletlen marad**, és
 *   `fan_out` node esetén a kibontás bejegyzés sem születik meg.
 * - `deferred_marks_settled`: a halasztás lezárult. A `keptEdgeIds` élek
 *   KIVÉTELÉVEL minden kimenő él `dead` jelölést kap, `fan_out` node esetén
 *   pedig halott kibontás bejegyzés születik. A kihagyott élek azok, amik a
 *   halasztás alatt már `live` jelölést kaptak; azok felülírása visszamenőleg
 *   tenné halottá a rajtuk elindult ágat.
 *
 * **Miért kell a halasztás** (SPEC-004 8.2 5. pont). A 4.4 5. pontja a hibára
 * futó példány nem menekülő éleire azonnali `dead` jelölést mond, a 8.2
 * 5. pontja viszont azt, hogy sikeres újrapróbálkozás után a vezérlés a
 * **megismételt** példány saját kimenő élein megy tovább. Ha a `dead` jelölés
 * már az első, sikertelen lefutáskor kikerülne, egy több bejövő élű
 * leszármazott a 4.4 2. pontja szerint ("legalább egy jelölés `live`") azonnal
 * futtathatóvá válna a hibás ág jelölésével, lefutna, majd a sikeres
 * újrapróbálkozás után MÁSODSZOR is lefutna, azonos `attempt` értékkel.
 * Ugyanez áll az `error_handler` saját `exhausted` élére, amíg a kezelő újabb
 * kísérletet ütemez: a kezelő még lefuthat mégegyszer, és akkor az `exhausted`
 * ág `live` jelölést kap. A jelölés ezért mindkét esetben megvárja, amíg a
 * példány sorsa véglegessé válik. Ugyanaz az elv, mint az `applyLoopAdvanced`
 * nem választott ágánál: nem végleges jelölést nem írunk ki.
 */
export type SchedulingEvent =
  | {
      readonly kind: 'node_completed';
      readonly instance: StepInstanceReference;
      readonly liveEdgeIds: ReadonlySet<string>;
    }
  | {
      readonly kind: 'outgoing_marks_deferred';
      readonly instance: StepInstanceReference;
      readonly liveEdgeIds: ReadonlySet<string>;
    }
  | {
      readonly kind: 'deferred_marks_settled';
      readonly instance: StepInstanceReference;
      readonly keptEdgeIds: ReadonlySet<string>;
    }
  | {
      readonly kind: 'fan_out_expanded';
      readonly instance: StepInstanceReference;
      readonly stepRunId: string;
      readonly items: readonly unknown[];
    }
  | {
      readonly kind: 'loop_advanced';
      readonly instance: StepInstanceReference;
      readonly stepRunId: string;
      readonly shouldContinue: boolean;
    };
