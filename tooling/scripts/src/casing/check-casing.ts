/**
 * CLI belépési pont: kilistázza a git index fájlnevek és a relatív importok
 * betűzése közti eltéréseket. A `tooling/scripts/casing.sh` hívja.
 *
 * Kimenet: eltérésenként egy sor, `stdout`-ra. Üres kimenet + `0` kilépőkód =
 * nincs eltérés. Ha van eltérés, a kilépőkód `1`.
 */
import { execFileSync } from 'node:child_process';
import { findCasingMismatches } from './find-casing-mismatches.ts';

function repoRoot(): string {
  // eslint-disable-next-line sonarjs/no-os-command-from-path -- a git a fejlesztoi/CI PATH resze, ugyanugy mint a tobbi wrapper scriptben
  return execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim();
}

const mismatches = findCasingMismatches(repoRoot());

for (const mismatch of mismatches) {
  console.log(
    `${mismatch.file}:${String(mismatch.line)}: import '${mismatch.specifier}', a git szerinti fájlnév '${mismatch.trackedPath}'`,
  );
}

process.exitCode = mismatches.length === 0 ? 0 : 1;
