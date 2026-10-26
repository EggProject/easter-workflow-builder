import { chmodSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { query } from '@anthropic-ai/claude-agent-sdk';
import { describe, expect, it } from 'vitest';
import { buildOutgoingEnvironment } from '@easter-workflow-builder/engine';
import { providerRegistry } from '@easter-workflow-builder/provider-registry';
import { isString } from '@easter-workflow-builder/typeguards';
import { createProcessEnvironmentReader } from '../engine-assembly/create-process-environment-reader.ts';

/**
 * Az alfolyamat szintje (SPEC-012 7., PLAN-013 T-013-5, research 3. M-143
 * mintája): a valódi SDK `query()` hívás egy hamis CLI végrehajthatóval, ami a
 * kapott környezet változóneveit fájlba írja és azonnal kilép. Hálózatot és
 * valódi providert nem érint. A `claude-subscription` valódi leírójából épült
 * kimenő `env` mellett az alfolyamat látja a `PATH`-ot és a `HOME`-ot, a
 * tiltott `ANTHROPIC_API_KEY`-t viszont nem.
 *
 * A teszt futásideje a research 14.4 szekciójában mért, a teszt korlát alatt.
 */

const FAKE_CLI_SOURCE = `#!/usr/bin/env node
import { writeFileSync } from 'node:fs';
writeFileSync(process.env.PROBE_OUT, JSON.stringify(Object.keys(process.env).sort()));
process.exit(0);
`;

function isStringArray(value: unknown): value is readonly string[] {
  return Array.isArray(value) && value.every((item) => isString(item));
}

async function runFakeCli(fakeCli: string, environment: Readonly<Record<string, string>>): Promise<void> {
  const running = query({ prompt: 'x', options: { env: environment, pathToClaudeCodeExecutable: fakeCli } });
  // A hamis CLI nem beszél protokollt: a folyam hibával vagy üresen zárul, a tárgy a kapott környezet.
  try {
    for await (const message of running) {
      expect(message).toBeDefined();
    }
  } catch {
    // elvárt: a hamis CLI azonnal kilép
  }
}

describe('a claude-subscription kimenő env az alfolyamatban', () => {
  it('a PATH és a HOME átmegy, a tiltott ANTHROPIC_API_KEY nem', async () => {
    const workDirectory = mkdtempSync(path.join(tmpdir(), 'easter-env-probe-'));
    const previousApiKey = process.env['ANTHROPIC_API_KEY'];
    process.env['ANTHROPIC_API_KEY'] = 'teszt-nem-jut-ki';
    try {
      const fakeCli = path.join(workDirectory, 'fake-cli.mjs');
      const outputFile = path.join(workDirectory, 'names.json');
      writeFileSync(fakeCli, FAKE_CLI_SOURCE);
      chmodSync(fakeCli, 0o755);

      const descriptor = providerRegistry['claude-subscription'];
      const outgoing = buildOutgoingEnvironment(
        descriptor.requiredEnv,
        descriptor.disallowedEnv,
        createProcessEnvironmentReader(),
      );
      expect(outgoing.kind).toBe('ok');
      if (outgoing.kind !== 'ok') {
        return;
      }

      await runFakeCli(fakeCli, { ...outgoing.value, PROBE_OUT: outputFile });

      const parsed: unknown = JSON.parse(readFileSync(outputFile, 'utf8'));
      expect(isStringArray(parsed)).toBe(true);
      const names = isStringArray(parsed) ? parsed : [];
      expect(names).toContain('PATH');
      expect(names).toContain('HOME');
      expect(names).not.toContain('ANTHROPIC_API_KEY');
    } finally {
      if (previousApiKey === undefined) {
        Reflect.deleteProperty(process.env, 'ANTHROPIC_API_KEY');
      } else {
        process.env['ANTHROPIC_API_KEY'] = previousApiKey;
      }
      rmSync(workDirectory, { recursive: true, force: true });
    }
  });
});
