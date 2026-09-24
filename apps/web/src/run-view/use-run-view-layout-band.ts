import { useEffect, useState } from 'react';
import {
  RUN_VIEW_HORIZONTAL_MEDIA_QUERY,
  RUN_VIEW_VERTICAL_MEDIA_QUERY,
  resolveRunViewLayoutBand,
  type RunViewLayoutBand,
} from './run-view-layout-band.ts';

/**
 * A jelenlegi sáv leolvasása a böngészőtől. Mindkét query külön
 * `matchMedia` hívás: a `MediaQueryList.matches` az egyetlen dokumentált
 * mód a töréspont állapotának leolvasására JS-ből, és a viewport
 * szélességének saját kiszámolása (`innerWidth` olvasás) NEM
 * helyettesíti, mert nem ugyanaz a viewport modell, amit a media query
 * használ.
 */
function readLayoutBand(): RunViewLayoutBand {
  return resolveRunViewLayoutBand(
    globalThis.matchMedia(RUN_VIEW_HORIZONTAL_MEDIA_QUERY).matches,
    globalThis.matchMedia(RUN_VIEW_VERTICAL_MEDIA_QUERY).matches,
  );
}

/**
 * A futás nézet kiválasztott reszponzív sávja, a viewport változását
 * követve (SPEC-008 10., AC33). A `change` esemény mindkét
 * `MediaQueryList` példányra fel van iratkozva, és mindkettő ugyanazt a
 * teljes újraolvasást futtatja: a két töréspont között mozgó viewport
 * egyetlen eseményből nem határozza meg a sávot, tehát a részleges
 * állapotkövetés hibás lenne.
 *
 * Az esemény kezelés `addEventListener('change', ...)` alakú, nem a
 * deprecated `addListener` hívás (MDN: "Deprecated ... use
 * addEventListener() instead",
 * <https://developer.mozilla.org/en-US/docs/Web/API/MediaQueryList/addListener>),
 * ugyanaz a minta, mint a `packages/ui` `use-theme-mode` hookjában.
 */
export function useRunViewLayoutBand(): RunViewLayoutBand {
  const [band, setBand] = useState<RunViewLayoutBand>(readLayoutBand);

  useEffect(() => {
    const handleChange = (): void => {
      setBand(readLayoutBand());
    };
    const largeScreenMedia = globalThis.matchMedia(RUN_VIEW_HORIZONTAL_MEDIA_QUERY);
    const mediumScreenMedia = globalThis.matchMedia(RUN_VIEW_VERTICAL_MEDIA_QUERY);
    largeScreenMedia.addEventListener('change', handleChange);
    mediumScreenMedia.addEventListener('change', handleChange);
    return (): void => {
      largeScreenMedia.removeEventListener('change', handleChange);
      mediumScreenMedia.removeEventListener('change', handleChange);
    };
  }, []);

  return band;
}
