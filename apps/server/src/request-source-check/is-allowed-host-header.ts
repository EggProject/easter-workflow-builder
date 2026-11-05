import { LOOPBACK_HOST_NAMES } from './loopback-host-names.ts';

/**
 * A `Host` fejléc ellenőrzése, a DNS rebinding ellen (SPEC-017 5.2): a
 * fejléc pontosan a szerver egyik helyi neve és a kapcsolat helyi portja. Egy
 * DNS rebinding támadásban a böngésző a támadó nevét küldi a `Host`
 * fejlécben (Vite GHSA-vg6x-rcgg-rjx6 [3],
 * https://github.com/vitejs/vite/security/advisories/GHSA-vg6x-rcgg-rjx6),
 * ezért az ilyen kérés itt elbukik.
 *
 * A port a kapcsolat helyi portja (`socket.localPort`), nem a konfiguráció
 * értéke: `EASTER_SERVER_PORT=0` mellett a portot az operációs rendszer
 * választja (SPEC-012 5.1), más esetben a kettő azonos. A várt alakot a
 * WHATWG URL szerializálása adja, ami az alapértelmezett portot elhagyja,
 * pontosan úgy, ahogy a böngésző a `Host` fejlécben
 * (https://url.spec.whatwg.org/#concept-url-port). A név kis- és
 * nagybetűtől független (RFC 3986 3.2.2), ezért a bejövő értéket
 * kisbetűsítjük. Hiányzó fejléc vagy ismeretlen helyi port elutasít.
 */
export function isAllowedHostHeader(hostHeader: string | undefined, localPort: number | undefined): boolean {
  if (hostHeader === undefined || localPort === undefined) {
    return false;
  }
  const received = hostHeader.toLowerCase();
  return LOOPBACK_HOST_NAMES.some((name) => new URL(`http://${name}:${String(localPort)}`).host === received);
}
