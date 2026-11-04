/**
 * A szerver így jelenti a stdout első sorában a ténylegesen lekötött portját
 * (SPEC-012 5.1): `EASTER_SERVER_PORT=0` esetén a portot az operációs rendszer
 * a kötéskor osztja ki (Node `server.listen(0)`), és a hívó (a valódi próba,
 * `measurement/start-probe-server.ts`) ebből a sorból tudja meg. A portot a
 * kötést végző folyamat választja, tehát a választás és a kötés között nincs
 * ablak, amiben egy másik folyamat elvehetné. A valódi szerver
 * (`continue-startup-with-database.ts`) és a hamis ágenses próba szerver
 * (`measurement/stub-agent-server.ts`) ugyanezt a sort írja.
 */
export const PROBE_PORT_REPORT_PREFIX = 'EASTER_PROBE_PORT=';

export function formatProbePortReport(port: number): string {
  return `${PROBE_PORT_REPORT_PREFIX}${String(port)}\n`;
}
