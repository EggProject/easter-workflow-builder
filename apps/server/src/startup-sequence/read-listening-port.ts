import type { Server } from 'node:net';

/**
 * A figyelő szerver ténylegesen lekötött TCP portja, a `listening` esemény
 * után. A Node dokumentációja szerint IP socketen figyelő szerverre az
 * `address()` `{ port, family, address }` objektumot ad, csővezetéken vagy
 * Unix socketen szöveget, a `listening` előtt `null`-t
 * (<https://nodejs.org/api/net.html#serveraddress>). A szerver mindig IP
 * címre köt (`127.0.0.1`), ezért a másik két alak programhiba, amit a
 * függvény kivétellel jelez.
 */
export function readListeningPort(server: Pick<Server, 'address'>): number {
  const address = server.address();
  if (address === null || typeof address === 'string') {
    throw new Error(`A szerver nem IP porton figyel (cím: ${String(address)}).`);
  }
  return address.port;
}
