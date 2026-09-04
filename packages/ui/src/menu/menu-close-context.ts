import { createContext } from 'react';

/**
 * A `MenuItem` ezen keresztül kéri a befoglaló `Menu` panel bezárását
 * kiválasztás után (lásd `Menu.tsx`). Az alapérték no-op, hogy egy `Menu`-n
 * kívül renderelt `MenuItem` (pl. önálló tesztben) ne dobjon hibát.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-function -- szándékos no-op alapérték, lásd a fenti indoklást
export const MenuCloseContext = createContext<() => void>(() => {});
