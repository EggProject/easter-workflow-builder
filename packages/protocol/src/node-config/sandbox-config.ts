import { z } from 'zod';

/**
 * Az `Options.sandbox` tárolt alakja, a `packages/db` `sandbox-config.ts`
 * mirror sémája. Öt mező forrásból levezetett típusú, öt mező (`network`,
 * `filesystem`, `allowUnsandboxedCommands`, `ignoreViolations`, `ripgrep`)
 * `unknown` és elhagyható - ugyanazon okból, mint a `db` oldalán: tippelni
 * tilos, a pontos alakjuk lezárása külön mérést igényel (`db`
 * `sandbox-config.ts` doksija).
 */
export const SandboxConfigSchema = z
  .strictObject({
    enabled: z.boolean(),
    failIfUnavailable: z.boolean(),
    autoAllowBashIfSandboxed: z.boolean(),
    excludedCommands: z.array(z.string()).readonly(),
    enableWeakerNestedSandbox: z.boolean(),
    allowUnsandboxedCommands: z.unknown().optional(),
    network: z.unknown().optional(),
    filesystem: z.unknown().optional(),
    ignoreViolations: z.unknown().optional(),
    ripgrep: z.unknown().optional(),
  })
  .readonly();

export type SandboxConfig = z.infer<typeof SandboxConfigSchema>;
