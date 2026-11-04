import { describe, expect, it } from 'vitest';
import { formatProbePortReport, PROBE_PORT_REPORT_PREFIX } from './probe-port-report.ts';

describe('formatProbePortReport', () => {
  it('egyetlen, sortöréssel zárt sor az előtaggal és a porttal', () => {
    expect(formatProbePortReport(39_355)).toBe('EASTER_PROBE_PORT=39355\n');
    expect(formatProbePortReport(1).startsWith(PROBE_PORT_REPORT_PREFIX)).toBe(true);
  });
});
