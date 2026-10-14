import type { NodeType } from '@easter-workflow-builder/protocol';

/**
 * A felvehető csomópont típusok: a tíz `NodeType` közül kilenc, a `start`
 * kivételével (SPEC-008 5.8, user döntés 6.). A Start felvétele így fordítási
 * hiba, nem futásidejű ág; a Startot az új workflow a létrehozásakor kapja a
 * szervertől (O-20), a régi, Start nélküli workflow pedig a betöltéskor
 * (O-28).
 */
export type AddableNodeType = Exclude<NodeType, 'start'>;
