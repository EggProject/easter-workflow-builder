import { createContext } from 'react';

/**
 * A panel aktuális, mezőnkénti hibatérképe: a `NodeConfigSchema.safeParse`
 * hibáiból épült, ponttal összefűzött útvonal (`branches.0.key`) mutat a
 * hibaüzenetre (`field-errors-from-zod-error.ts`).
 *
 * Miért kontextus, és nem prop: a hibaüzenetnek a HIBÁS MEZŐ ALATT kell
 * megjelennie (SPEC-008 5.2, AC16 "mezőnkénti hibajelzéssel"), a mezők
 * viszont tíz csomópont típus szerinti komponensben, több szinten mélyen
 * állnak. Egy prop láncolás minden köztes komponens szignatúráját
 * átírná anélkül, hogy azok bármit kezdenének az értékkel; a kontextus
 * alapértelmezése pedig üres térkép, tehát a komponensek önálló tesztben,
 * szolgáltató nélkül is változatlanul renderelhetők.
 *
 * A mintát a `packages/ui` `resizable-context.ts` fájlja követi: kontextus
 * objektum saját fájlban, `.spec` pár nélkül, mert nem tartalmaz futásidejű
 * elágazást.
 */
export const FieldErrorsContext = createContext<ReadonlyMap<string, string>>(new Map<string, string>());
