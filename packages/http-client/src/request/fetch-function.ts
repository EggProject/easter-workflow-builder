/**
 * A `fetch` befecskendezhető alakja. Azért paraméter és nem közvetlen globális
 * hívás, hogy a unit teszt hálózat nélkül tudja lefedni minden hibaágat.
 */
export type FetchFunction = (input: string, init: RequestInit) => Promise<Response>;
