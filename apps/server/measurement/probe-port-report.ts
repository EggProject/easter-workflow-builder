/**
 * A gyermek szerver így jelenti a stdout első sorában a ténylegesen lekötött
 * portját, ha a szülő `0` portot kért tőle (`ProbeServerCommand` `reports-port`
 * ága): a portot a kötést végző folyamat választja, tehát a választás és a
 * kötés között nincs ablak, amiben egy másik folyamat elvehetné.
 */
export const PROBE_PORT_REPORT_PREFIX = 'EASTER_PROBE_PORT=';

export function formatProbePortReport(port: number): string {
  return `${PROBE_PORT_REPORT_PREFIX}${String(port)}\n`;
}
