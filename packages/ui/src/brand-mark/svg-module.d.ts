// Ambiens típusdeklaráció az SVG URL importokhoz (pl. `import logoMarkUrl
// from './logo-mark.svg'`). A Vite alapértelmezésben a statikus asset
// importot a feloldott URL sztringként adja vissza (Static Asset Handling,
// https://vite.dev/guide/assets, "Importing Asset as URL" szekció, mérve a
// projekt pinelt 8.2.2 verziója ellen: a doksi oldal saját verziójelzése is
// "v8.2.2"). A `packages/ui` viszont Vite függőség nélkül, önállóan
// típusellenőrzött (`tsc --noEmit`, ugyanaz az indok, mint a
// `design-token/css-module.d.ts` fejlécében), ezért saját deklaráció kell,
// a `vite/client` helyett. Típus only fájl, nincs futásidejű sora,
// `.spec.ts` párja nincs.
declare module '*.svg' {
  const url: string;
  export default url;
}
