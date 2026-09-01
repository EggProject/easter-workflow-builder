/**
 * Feltételes CSS osztálynév lista összefűzése. A `false` / `undefined` /
 * üres string elemek kiesnek, a többi szóközzel elválasztva összefűzve. A
 * design system forrás komponensei `.filter(Boolean).join(' ')` mintát
 * használnak; ez ennek típusbiztos, `any` és `as` nélküli megfelelője,
 * amit minden átemelt komponens téma újrahasznosít (SPEC-007 6.2).
 */
export function joinClassNames(...classNames: readonly (string | false | undefined)[]): string {
  return classNames.filter((name): name is string => typeof name === 'string' && name.length > 0).join(' ');
}
