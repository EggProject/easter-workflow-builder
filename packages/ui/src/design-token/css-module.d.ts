// Ambiens típusdeklaráció a CSS oldalhatás importokhoz (pl. `import
// './button.css'`). A Vite saját `vite/client.d.ts` fájlja ugyanezt adja,
// de a `packages/ui` Vite függőség nélkül, önállóan típusellenőrzött
// (`tsc --noEmit`), ezért saját deklaráció kell. Típus only fájl, nincs
// futásidejű sora, `.spec.ts` párja nincs.
declare module '*.css';
