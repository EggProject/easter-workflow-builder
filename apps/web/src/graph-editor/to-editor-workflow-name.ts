import type { RequestState } from '../request-state/request-state.ts';
import type { EditorWorkflowName } from './editor-workflow-name.ts';

/**
 * A két adat nélküli állapot egyetlen, közös objektuma: az `idle` és a
 * `pending` kérés, illetve minden elérhetetlen eset azonos hivatkozást ad, így
 * a jelentést figyelő hatás nem fut újra egy valójában változatlan értékre.
 */
const LOADING: EditorWorkflowName = { kind: 'loading' };
const UNAVAILABLE: EditorWorkflowName = { kind: 'unavailable' };

/**
 * A workflow rekord betöltési állapotából a morzsasor nevét adó értéket
 * képzi. A `workflowId` hiánya `unavailable`, mert ott nincs mit betölteni; a
 * még el nem indult (`idle`) és a folyamatban lévő (`pending`) kérés egyaránt
 * `loading`, hogy a képernyő csatolásának első képkockáján se villanjon fel
 * az útvonal felirata a csontváz előtt.
 */
export function toEditorWorkflowName(
  workflowId: string | undefined,
  state: RequestState<{ readonly name: string }>,
): EditorWorkflowName {
  if (workflowId === undefined) {
    return UNAVAILABLE;
  }
  switch (state.status) {
    case 'idle':
    case 'pending': {
      return LOADING;
    }
    case 'success': {
      return { kind: 'ready', name: state.value.name };
    }
    case 'failure': {
      return UNAVAILABLE;
    }
  }
}
