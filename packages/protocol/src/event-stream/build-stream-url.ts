import { STREAM_PATH } from '../http-route/stream-path.ts';

/**
 * A stream kapcsolat URL-je egyetlen `streamId` értékből (SPEC-005 5.1 és
 * 5.2 szekció). **A csomag szándékosan nem exportál futás azonosítóból
 * (`runId`) stream URL-t építő függvényt**: futásonként külön kapcsolatot
 * nyitni tilos (5.1 szekció, F-8), egy fülhöz pontosan egy stream tartozik,
 * és a nézett futások listáját a `SubscriptionRequest` REST hívás írja le,
 * nem az URL (20. kritérium). Ezt a `build-stream-url.spec.ts` greppes
 * tesztje igazolja.
 */
export function buildStreamUrl(streamId: string): string {
  return `${STREAM_PATH}?streamId=${encodeURIComponent(streamId)}`;
}
