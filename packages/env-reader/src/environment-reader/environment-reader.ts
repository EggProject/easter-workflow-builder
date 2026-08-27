/**
 * Környezeti változó olvasó. Szándékosan sima, csak olvasható rekord és nem
 * függvény: így a teszt egy objektum literált ad át, a termékkód pedig a
 * `process.env` értéket, minden extra absztrakció nélkül. A projektben nincs
 * `dotenv`, a `.env` betöltése a futtató környezet dolga.
 */
export type EnvironmentReader = Readonly<Record<string, string | undefined>>;
