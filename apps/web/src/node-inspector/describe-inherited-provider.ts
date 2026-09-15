/**
 * A lépés szintű `providerId` `null` értéke esetén megnevezi, melyik
 * providert örökli a lépés (SPEC-008 5.2 "A provider választás három
 * szintje", AC17). A workflow szintű felülírás (`WorkflowDetail.providerId`)
 * erősebb, mint a globális alapértelmezés (`SettingsRecord.defaultProviderId`);
 * ha egyik szinten sincs felülírás, a panel ezt is kimondja, találgatás
 * nélkül.
 */
export function describeInheritedProvider(workflowProviderId: string | null, defaultProviderId: string | null): string {
  if (workflowProviderId !== null) {
    return `a workflow saját providerét örökli: ${workflowProviderId}`;
  }
  if (defaultProviderId !== null) {
    return `a globális alapértelmezést örökli: ${defaultProviderId}`;
  }
  return 'sem a workflow, sem a globális alapértelmezés nem ad meg providert - felülírás nélkül a futtatás providere nincs meghatározva';
}
