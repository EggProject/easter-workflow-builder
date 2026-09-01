// A csomag publikus felülete: kizárólag nevesített újraexport, `export *`
// nélkül (SPEC-002 6.6). A barrel a coverage kizárási listáján van, ezért
// futásidejű elágazást nem tartalmazhat.

// frontend-config: a kötelező, alapérték nélküli felületi konfiguráció.
export type { FrontendConfig } from './frontend-config/frontend-config.ts';
export { readFrontendConfig } from './frontend-config/read-frontend-config.ts';
