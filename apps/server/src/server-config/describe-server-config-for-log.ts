import type { ServerConfig } from './server-config.ts';

/**
 * Az induláskor kiírt konfigurációs napló sor mezői (SPEC-006 7.4 4. pont,
 * 36. elfogadási kritérium): az env változók **nevét** és a "be van
 * állítva" tényt közli, sosem az értéket - kivétel a napló könyvtár, a
 * port, a skill könyvtár útvonala és a három skill korlát (SPEC-009 5.4 6.
 * pont), mert ezek nem titkok és a hibakeresés nélkülük vak.
 */
export function describeServerConfigForLog(config: ServerConfig): Readonly<Record<string, unknown>> {
  return {
    port: config.port,
    logDirectory: config.logDirectory,
    logRotationSizeConfigured: true,
    logRotationFrequencyConfigured: true,
    logRetainedFileCountConfigured: true,
    streamKeepAliveIntervalMsConfigured: true,
    skillLibraryDirectory: config.skillLibraryDirectory,
    skillMaxArchiveBytes: config.skillMaxArchiveBytes,
    skillMaxUnpackedBytes: config.skillMaxUnpackedBytes,
    skillMaxEntryCount: config.skillMaxEntryCount,
    logLevelConfigured: config.logLevel !== undefined,
    devOriginConfigured: config.devOrigin !== undefined,
  };
}
