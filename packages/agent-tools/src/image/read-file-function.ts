/**
 * Fájlolvasó befecskendezhető alakja, hogy a unit teszt valódi lemezművelet
 * nélkül is le tudja fedni a hibaágat.
 */
export type ReadFileFunction = (filePath: string) => Promise<Uint8Array>;
