import { createServer } from 'node:net';

/**
Szabad TCP port a `127.0.0.1` címen: az operációs rendszer osztja ki (`listen(0)`), majd felszabadítja.
*/
export function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const probe = createServer();
    probe.once('error', reject);
    probe.listen(0, '127.0.0.1', () => {
      const address = probe.address();
      if (address === null || typeof address === 'string') {
        probe.close();
        reject(new Error('Az operációs rendszer nem adott portot.'));
        return;
      }
      probe.close(() => {
        resolve(address.port);
      });
    });
  });
}
