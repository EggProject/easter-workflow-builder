/**
 * Egy `unknown` érték olvasható szöveggé alakítása, a csak olvasható
 * mezőkhöz (`skills`, `mcpServers`, a nem megerősített `agents` bejegyzés
 * mezők, `sandbox` ismeretlen almezői). Sztringet változatlanul mutat,
 * mindent mást JSON alakban - a cél a hibátlan megjelenítés, nem a
 * szerkeszthetőség.
 */
export function describeUnknownValue(value: unknown): string {
  if (value === undefined) {
    return '(nincs megadva)';
  }
  if (typeof value === 'string') {
    return value;
  }
  return JSON.stringify(value);
}
