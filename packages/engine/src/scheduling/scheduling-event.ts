import type { StepInstanceReference } from '../run-context/step-instance-reference.ts';

/**
 * Az ütemező állapotát léptető események (SPEC-004 4.4 ... 4.6). Mindhárom egy
 * **már lezárult** node példányról szól: az ütemező nem dönt arról, mi a
 * választott ág, hány elemre bomlik egy `fan_out`, vagy folytatódik-e a
 * ciklus; azt a node végrehajtó dönti el (5. szekció), és ide már kész
 * eredményként érkezik.
 *
 * - `node_completed`: a példány lefutott, és a `liveEdgeIds` halmaz mondja
 *   meg, mely kimenő élei kapnak `live` jelölést; minden más kimenő éle
 *   `dead` jelölést kap (4.4 4. pont). Ez az esemény hordozza a hibaágat is:
 *   hibára futó példánynál a halmaz az `on_error` élt tartalmazza, és mást nem
 *   (4.4 5. pont). A `branch` node választott ága, a `human_approval` döntés
 *   iránya és az `error_handler` `exhausted` éle mind ugyanez az esemény.
 * - `fan_out_expanded`: a példány N elemre bomlott. Az `items` az elem
 *   **értékek** listája, mert az ütemezőnek a `RunContext.item` mezőhöz azt is
 *   nyilván kell tartania (6.1); a `stepRunId` a kibontó lépés futásának
 *   azonosítója, ami a nyitott hatókör bejegyzésekbe kerül (4.3).
 * - `loop_advanced`: a `loop` példány lefutott, és a `shouldContinue` a
 *   kiértékelt `continueExpression` logikai eredménye (4.6 3. pont). Az
 *   `iteration` értéket az ütemező maga vezeti, ezért az eseményben nincs
 *   benne.
 */
export type SchedulingEvent =
  | {
      readonly kind: 'node_completed';
      readonly instance: StepInstanceReference;
      readonly liveEdgeIds: ReadonlySet<string>;
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
