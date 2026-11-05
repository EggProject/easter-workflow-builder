/**
 * A szerver helyi nevei a `Host` fejléc ellenőrzéshez (SPEC-017 5.2). A
 * szerver kizárólag a `127.0.0.1` címre köt (SPEC-006 3.5), tehát egy
 * böngésző csak e cím vagy a `localhost` név alatt érheti el; a `localhost`
 * a loopback címre oldódik fel (RFC 6761 6.3,
 * https://www.rfc-editor.org/rfc/rfc6761#section-6.3). Az `[::1]` nem
 * szerepel, mert az IPv6 loopback címen a szerver nem hallgat.
 */
export const LOOPBACK_HOST_NAMES = ['127.0.0.1', 'localhost'] as const;
