import { createRoot } from 'react-dom/client';
import { AppShell } from '../app-shell/app-shell.tsx';
import { readFrontendConfig } from '../frontend-config/read-frontend-config.ts';
import { browserFetchFunction } from '../rest-client/browser-fetch-function.ts';

/**
 * Az alkalmazás egyetlen csatolási pontja (SPEC-007 12.2, T-008-18). Minden
 * elágazás itt áll, nem a `main.tsx`-ben: a hiányzó `#root` eleme (1. async
 * pont helyőrzője csak akkor íródik felül, ha ez az elem tényleg megvan), és
 * a hiányzó/érvénytelen kötelező konfiguráció (SPEC-007 O-4, O-6) mindkettő
 * itt dől el, saját ággal.
 */
export function mountApp(): void {
  const root = document.querySelector('#root');
  if (root === null) {
    throw new Error('A #root elem hiányzik a dokumentumból.');
  }

  const config = readFrontendConfig(import.meta.env);
  if (config.kind === 'error') {
    root.textContent = config.message;
    return;
  }

  createRoot(root).render(
    <AppShell
      apiOrigin={config.value.apiOrigin}
      streamOrigin={config.value.streamOrigin}
      listLimit={config.value.listLimit}
      streamReplayLimit={config.value.streamReplayLimit}
      fetchFunction={browserFetchFunction}
    />,
  );
}
