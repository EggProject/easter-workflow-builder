/**
 * A szerkesztett workflow neve a morzsasor utolsó eleméhez (SPEC-008 9.
 * szekció 2. async pontja, user döntés 2026-10-21): a morzsasort az
 * `app-shell` rajzolja, a nevet viszont a `GraphEditorScreen` tölti be, ezért
 * a képernyő ezt a háromállapotú értéket jelenti az `app-shell` felé.
 *
 * - `loading`: a név még töltődik (a morzsasorban `Skeleton` áll).
 * - `ready`: a betöltött név.
 * - `unavailable`: a név nem érhető el (hiányzó `workflowId` vagy hibás
 *   betöltés), a morzsasor az útvonal feliratát mutatja.
 *
 * **Típus-only fájl, nincs `.spec.ts` párja** (`apps/web/CLAUDE.md` ## Fájlok
 * konvenció).
 */
export type EditorWorkflowName =
  | { readonly kind: 'loading' }
  | { readonly kind: 'ready'; readonly name: string }
  | { readonly kind: 'unavailable' };
