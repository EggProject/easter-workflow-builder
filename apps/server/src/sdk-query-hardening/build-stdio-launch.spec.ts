import { spawnSync } from 'node:child_process';
import { describe, expect, it } from 'vitest';
import { buildStdioLaunch } from './build-stdio-launch.ts';

// Valódi folyamatindítás: a gyerek a kapott környezet neveit és a kapott argumentumokat írja ki.
const PRINT_CHILD =
  'process.stdout.write(JSON.stringify({ names: Object.keys(process.env).sort(), args: process.argv.slice(1) }))';

function runLaunch(
  allowedNames: readonly string[],
  extraArguments: readonly string[],
  environment: Readonly<Record<string, string>>,
): { readonly status: number | null; readonly stdout: string; readonly stderr: string } {
  const launch = buildStdioLaunch(process.execPath, ['-e', PRINT_CHILD, '--', ...extraArguments], allowedNames);
  const result = spawnSync(launch.command, launch.args, { env: environment, encoding: 'utf8' });
  return { status: result.status, stdout: result.stdout, stderr: result.stderr };
}

describe('buildStdioLaunch', () => {
  it('a parancs a motor Node folyamata, az indító forrása és a nevek az argumentumban, érték nélkül', () => {
    const launch = buildStdioLaunch('github-mcp', ['--stdio'], ['GITHUB_TOKEN']);
    expect(launch.command).toBe(process.execPath);
    expect(launch.args.slice(2)).toStrictEqual(['--', '["GITHUB_TOKEN"]', 'github-mcp', '--stdio']);
  });

  it('a gyerek csak a megengedett neveket, a PATH és a HOME változót kapja (O-45)', () => {
    const result = runLaunch(['DEKLARALT'], [], {
      PATH: process.env['PATH'] ?? '',
      HOME: '/home/proba',
      DEKLARALT: 'ertek',
      ANTHROPIC_API_KEY: 'nem-titok-jelolo',
      MASIK_FIOK_TOKEN: 'nem-titok-jelolo',
    });
    expect(result.status).toBe(0);
    expect(JSON.parse(result.stdout)).toStrictEqual({ names: ['DEKLARALT', 'HOME', 'PATH'], args: [] });
  });

  it('a gyerek argumentumai változatlanok, a kötőjellel kezdődőek is', () => {
    const result = runLaunch([], ['--stdio', '-x', 'szokozos argumentum'], { PATH: process.env['PATH'] ?? '' });
    expect(JSON.parse(result.stdout)).toMatchObject({ args: ['--stdio', '-x', 'szokozos argumentum'] });
  });

  it('a gyerek kilépési kódjával lép ki', () => {
    const launch = buildStdioLaunch(process.execPath, ['-e', 'process.exit(3)'], []);
    expect(spawnSync(launch.command, launch.args, { env: {} }).status).toBe(3);
  });

  it('nem létező parancsra 127 kóddal lép ki, a hibát a hiba csatornára írja', () => {
    const launch = buildStdioLaunch('/nem/letezo/mcp-parancs', [], []);
    const result = spawnSync(launch.command, launch.args, { env: {}, encoding: 'utf8' });
    expect(result.status).toBe(127);
    expect(result.stderr).toContain('ENOENT');
  });

  it('a szabványos bemenetet a gyereknek adja (a stdio MCP protokoll csatornája)', () => {
    const launch = buildStdioLaunch(
      process.execPath,
      ['-e', "process.stdin.on('data', (d) => process.stdout.write(d))"],
      [],
    );
    const result = spawnSync(launch.command, launch.args, { env: {}, input: 'ping', encoding: 'utf8' });
    expect(result.stdout).toBe('ping');
  });

  it('a leállító jelzést továbbítja a gyereknek', async () => {
    const { spawn } = await import('node:child_process');
    const launch = buildStdioLaunch(
      process.execPath,
      [
        '-e',
        "process.on('SIGTERM', () => { process.stdout.write('kapta'); process.exit(0); }); process.stdout.write('kesz'); setInterval(() => {}, 1000);",
      ],
      [],
    );
    const child = spawn(launch.command, launch.args, { env: {} });
    let output = '';
    const exited = new Promise<number | null>((resolve) => child.on('exit', resolve));
    child.stdout.on('data', (chunk: Buffer) => {
      output += chunk.toString();
      if (output === 'kesz') {
        child.kill('SIGTERM');
      }
    });
    expect(await exited).toBe(0);
    expect(output).toBe('keszkapta');
  });
});
