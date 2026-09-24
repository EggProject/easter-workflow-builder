import { Skeleton, type SkeletonProperties } from '@easter-workflow-builder/ui';
import type { ReactElement } from 'react';
import { useIsDarkTheme } from './use-is-dark-theme.ts';

export type ThemedSkeletonProperties = Omit<SkeletonProperties, 'ink'>;

/**
 * A `packages/ui` `Skeleton` burkolója, ami az `ink` módosítót az élő
 * `data-theme` attribútumból oldja fel: sötét témában a forrás meglévő
 * `.skel--ink` változata fut, világos témában változatlan marad (user
 * döntés, 2026-09-23). A döntés ide van központosítva, hogy az `apps/web`
 * hívói ne ismételjék meg témánként, minden `Skeleton` hívás helyett ezt a
 * komponenst importálják.
 */
export function ThemedSkeleton(properties: Readonly<ThemedSkeletonProperties>): ReactElement {
  const isDarkTheme = useIsDarkTheme();
  return <Skeleton {...properties} ink={isDarkTheme} />;
}
