import { isRecord, isString } from '@easter-workflow-builder/typeguards';
import { EnvironmentVariableNameSchema } from '../mcp-server-definition/environment-variable-name.ts';

function isInvalidName(value: unknown): boolean {
  return isString(value) && !EnvironmentVariableNameSchema.safeParse(value).success;
}

function invalidNamePathsOf(serverName: string, reference: unknown): readonly (readonly string[])[] {
  if (!isRecord(reference)) {
    return [];
  }
  const { envBindings, authEnvName } = reference;
  const bindingEntries = isRecord(envBindings) ? Object.entries(envBindings) : [];
  const found: (readonly string[])[] = bindingEntries
    .filter(([, serverSideName]) => isInvalidName(serverSideName))
    .map(([declaredName]) => ['mcpServerReferences', serverName, 'envBindings', declaredName]);
  if (isInvalidName(authEnvName)) {
    found.push(['mcpServerReferences', serverName, 'authEnvName']);
  }
  return found;
}

/**
 * Egy agent lépés `mcpServerReferences` hivatkozásainak env változó név
 * hibái (SPEC-009 6.1 "A nevek szabálya", PLAN-012 T-012-27): az
 * `envBindings` minden ÉRTÉKE és a nem `null` `authEnvName` szerver oldali
 * változó NÉV, tehát a POSIX név alakján kell állnia. Enélkül egy REST úton
 * beírt érték (például egy titok) a `missing_mcp_server_env` üzenetben
 * visszaíródna. A visszaadott útvonalak a lépéshez képest relatívak
 * (`mcpServerReferences.<szerver>.envBindings.<deklarált név>`, illetve
 * `...authEnvName`).
 *
 * A bemenet `unknown`, mert a mentési séma finomítása a konfig típushibája
 * mellett is lefut (`when`): a nem szöveg érték típushiba, azt az olvasó séma
 * jelzi, itt nem számít.
 */
export function findInvalidMcpServerReferenceEnvironmentNames(agentStep: unknown): readonly (readonly string[])[] {
  const references = isRecord(agentStep) ? agentStep['mcpServerReferences'] : undefined;
  if (!isRecord(references)) {
    return [];
  }
  return Object.entries(references).flatMap(([serverName, reference]) => invalidNamePathsOf(serverName, reference));
}
