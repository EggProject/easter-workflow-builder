// Barrel: csak nevesített újraexport (SPEC-002 6.6 6. szabálya). A csomag téma mappánként
// bővül, ahogy a SPEC-005 végrehajtási lépései elkészülnek.

// Ideiglenes, eldobható séma (T-006-2, PLAN-006): kizárólag azt igazolja, hogy a Zod
// együtt tud élni a kilenc minőségi kapuval, mielőtt bármilyen domain tartalom íródna. A
// következő lépés (T-006-3) törli, és a valódi téma mappák váltják fel.
import { z } from 'zod';

const PlaceholderSchema = z.strictObject({ placeholder: z.string() });

export function isPlaceholder(value: unknown): boolean {
  return PlaceholderSchema.safeParse(value).success;
}
